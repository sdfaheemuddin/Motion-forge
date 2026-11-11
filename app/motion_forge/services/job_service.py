from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
from .render_service import RenderService

class JobService:
    def __init__(self,repository):
        self.repository=repository
        self.executor=ThreadPoolExecutor(max_workers=1,thread_name_prefix='motion-forge-render')
        # Jobs are persisted, but frames do not resume after a process restart.
        for path in repository.root.glob('*/job.json'):
            job=repository.get(path.parent.name)
            if job.get('status') in ('queued','running'):
                repository.update(job['id'],status='failed',error='Server restarted before this render completed; submit a new job.')

    def submit(self,project):
        job_id=str(uuid4())
        job=self.repository.update(job_id,status='queued',progress=0,project=project.document['id'])
        self.executor.submit(self._run,job_id,project)
        return job

    def _run(self,job_id,project):
        try:
            self.repository.update(job_id,status='running')
            output=self.repository.directory(job_id)/'video.mp4'
            manifest=RenderService().render(project,output,lambda value:self.repository.update(job_id,progress=value))
            self.repository.update(job_id,status='completed',progress=1,manifest=manifest)
        except Exception as error:
            self.repository.update(job_id,status='failed',error=str(error))

    def close(self):
        self.executor.shutdown(wait=True)
