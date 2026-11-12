from copy import deepcopy
from io import BytesIO
from pathlib import Path
import json
import shutil
import tempfile
import unittest
from PIL import Image
from motion_forge.services.builder_service import BuilderService, ConflictError
from motion_forge.utils.errors import MotionForgeError
from fastapi.testclient import TestClient
from motion_forge.controllers.api import create_app

ROOT=Path(__file__).resolve().parents[1]

class BuilderTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)
        shutil.copytree(ROOT/'templates'/'basic-motion',self.root/'templates'/'basic-motion')
        self.service=BuilderService(self.root)

    def tearDown(self):
        self.temp.cleanup()

    def test_blank_create_save_reopen_and_revision_conflict(self):
        bundle=self.service.create('My first video')
        docs=deepcopy(bundle['documents']);docs['scenes/main.json']['elements'][0]['text']='Edited title'
        saved=self.service.save(bundle['project'],docs,bundle['revision'])
        self.assertNotEqual(saved['revision'],bundle['revision'])
        self.assertEqual(self.service.bundle(bundle['project'])['documents'],docs)
        with self.assertRaises(ConflictError):
            self.service.save(bundle['project'],docs,bundle['revision'])

    def test_template_is_copied_and_original_protected(self):
        source='templates/basic-motion/project.json'
        original=self.service.bundle(source)
        copy=self.service.create('Template copy',source)
        self.assertFalse(copy['readOnly'])
        self.assertTrue(self.service.validate(copy['project'],copy['documents'])['valid'])
        self.assertEqual(self.service.bundle(source),original)
        with self.assertRaises(MotionForgeError):
            self.service.save(source,original['documents'],original['revision'])

    def test_invalid_save_never_changes_files(self):
        bundle=self.service.create('Invalid save')
        docs=deepcopy(bundle['documents']);docs['project.json']['canvas']['width']=-1
        self.assertFalse(self.service.validate(bundle['project'],docs)['valid'])
        with self.assertRaises(MotionForgeError):
            self.service.save(bundle['project'],docs,bundle['revision'])
        self.assertEqual(self.service.bundle(bundle['project']),bundle)
        docs=deepcopy(bundle['documents']);docs['project.json']['scenes']=['../outside.json'];docs['../outside.json']=docs.pop('scenes/main.json')
        self.assertFalse(self.service.validate(bundle['project'],docs)['valid'])

    def test_upload_register_save_and_preview(self):
        bundle=self.service.create('Asset test')
        buffer=BytesIO();Image.new('RGBA',(24,18),(50,150,200,100)).save(buffer,format='PNG')
        uploaded=self.service.upload(bundle['project'],'../transparent logo.png',buffer.getvalue())
        self.assertEqual(uploaded['metadata']['width'],24)
        self.assertNotIn('..',uploaded['asset']['source'])
        docs=deepcopy(bundle['documents']);docs['assets.json']['assets'].append(uploaded['asset'])
        docs['scenes/main.json']['elements'].append({'id':'logo','type':'image','asset':uploaded['asset']['id'],'width':120})
        self.assertTrue(self.service.validate(bundle['project'],docs)['valid'])
        preview=self.service.preview(bundle['project'],docs,0)
        self.assertEqual(preview[:8],b'\x89PNG\r\n\x1a\n')
        self.service.save(bundle['project'],docs,bundle['revision'])
        self.assertIn(uploaded['asset']['id'],self.service.bundle(bundle['project'])['assetMetadata'])
        with self.assertRaises(MotionForgeError):
            self.service.upload(bundle['project'],'fake.png',b'not an image')
        with self.assertRaises(MotionForgeError):
            self.service.asset_path(bundle['project'],'../../../../outside.png')

    def test_http_editor_and_origin_checks(self):
        with TestClient(create_app(self.root)) as client:
            self.assertEqual(client.get('/builder/templates').status_code,200)
            blocked=client.post('/builder/projects',json={'name':'Blocked'},headers={'origin':'https://untrusted.example'})
            self.assertEqual(blocked.status_code,403)
            created=client.post('/builder/projects',json={'name':'API project'})
            self.assertEqual(created.status_code,201,created.text)
            draft=created.json()
            self.assertTrue(client.post('/builder/validate',json=draft).json()['valid'])
            self.assertEqual(client.get('/builder/project',params={'project':'../../outside.json'}).status_code,400)
            self.assertEqual(client.put('/builder/project',json={**draft,'revision':'stale'}).status_code,409)
            self.assertEqual(client.get('/').status_code,200)
