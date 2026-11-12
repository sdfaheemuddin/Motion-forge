from pathlib import Path
import tempfile
import time
import unittest
try:
    from fastapi.testclient import TestClient
    from motion_forge.controllers.api import create_app
except ImportError:
    TestClient=None

ROOT=Path(__file__).resolve().parents[1]

@unittest.skipIf(TestClient is None,'Install .[api,dev] to test the HTTP API')
class APITests(unittest.TestCase):
    def test_validate_preview_and_path_scope(self):
        with TestClient(create_app(ROOT)) as client:
            self.assertEqual(client.get('/health').json(),{'status':'ok'})
            response=client.post('/validate',json={'project':'projects/quick-start/project.json'})
            self.assertEqual(response.status_code,200,response.text)
            self.assertTrue(response.json()['valid'])
            response=client.post('/preview',json={'project':'projects/quick-start/project.json','time':2})
            self.assertEqual(response.status_code,200,response.text[:100])
            self.assertEqual(response.headers['content-type'],'image/png')
            self.assertEqual(client.post('/validate',json={'project':'../../outside.json'}).status_code,400)
            self.assertEqual(client.get('/jobs/not-a-job').status_code,404)

    def test_render_job_completes_and_downloads(self):
        from motion_forge.infrastructure.ffmpeg.encoder import find_ffmpeg
        find_ffmpeg()
        with TestClient(create_app(ROOT)) as client:
            response=client.post('/renders',json={'project':'projects/quick-start/project.json'})
            self.assertEqual(response.status_code,202,response.text)
            job_id=response.json()['id']
            deadline=time.monotonic()+40
            while time.monotonic()<deadline:
                job=client.get(f'/jobs/{job_id}').json()
                if job['status'] in ('completed','failed'):
                    break
                time.sleep(0.05)
            self.assertEqual(job['status'],'completed',job)
            response=client.get(f'/jobs/{job_id}/video')
            self.assertEqual(response.status_code,200)
            self.assertIn(b'ftyp',response.content[:64])
            self.assertIn('quick-start.mp4',response.headers['content-disposition'])

if __name__=='__main__':
    unittest.main()
