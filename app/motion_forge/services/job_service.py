from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
from datetime import datetime, timezone
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
        job=self.repository.update(job_id,status='queued',progress=0,project=project.document['id'],createdAt=datetime.now(timezone.utc).isoformat())
        self.executor.submit(self._run,job_id,project)
        return job

    def _run(self,job_id,project):
        try:
            self.repository.update(job_id,status='running',startedAt=datetime.now(timezone.utc).isoformat())
            output=self.repository.directory(job_id)/project.export['filename']
            manifest=RenderService().render(project,output,lambda value:self.repository.update(job_id,progress=value))
            self.repository.update(job_id,status='completed',progress=1,manifest=manifest,completedAt=datetime.now(timezone.utc).isoformat())
        except Exception as error:
            self.repository.update(job_id,status='failed',error=str(error))

    def close(self):
        self.executor.shutdown(wait=True)
