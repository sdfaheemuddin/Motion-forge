import json
import threading
from pathlib import Path
from uuid import UUID

class JobRepository:
    def __init__(self,root):
        self.root=Path(root);self.root.mkdir(parents=True,exist_ok=True)
        self.lock=threading.RLock()

    def directory(self,job_id):
        # Reject path traversal even when called outside the HTTP controller.
        return self.root/str(UUID(job_id))

    def get(self,job_id):
        with self.lock:
            return json.loads((self.directory(job_id)/'job.json').read_text())

    def update(self,job_id,**values):
        with self.lock:
            directory=self.directory(job_id);directory.mkdir(parents=True,exist_ok=True)
            path=directory/'job.json'
            data=json.loads(path.read_text()) if path.is_file() else {'id':job_id}
            data.update(values)
            temporary=directory/'job.tmp'
            temporary.write_text(json.dumps(data,indent=2))
            temporary.replace(path)
            return data
