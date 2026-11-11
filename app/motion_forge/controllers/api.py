import os
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from .. import load_project
from ..repositories.job_repository import JobRepository
from ..services.job_service import JobService
from ..services.preview_service import PreviewService
from ..utils.errors import MotionForgeError

class ProjectRequest(BaseModel):
    project: str

class PreviewRequest(ProjectRequest):
    time: float = 0

def create_app(root=None):
    root=Path(root or os.environ.get('MOTION_FORGE_ROOT','.') or '.').resolve()
    repository=JobRepository(root/'output'/'jobs')
    jobs=JobService(repository)
    @asynccontextmanager
    async def lifespan(app):
        yield
        jobs.close()
    app=FastAPI(title='Motion Forge',version='0.1.0',lifespan=lifespan)

    def project_from(request):
        path=(root/request.project).resolve()
        if not path.is_relative_to(root):
            raise HTTPException(400,'Project path must be inside the configured API root.')
        try:
            project=load_project(path)
            # Referenced files are also confined to the API root.
            files=[key for key in project.sources if key!='project']
            files += [str((project.root/asset['source']).resolve()) for asset in project.assets.values() if not asset['source'].startswith('system:')]
            if any(not Path(file).is_relative_to(root) for file in files):
                raise MotionForgeError('Project references must remain inside the configured API root.')
            return project
        except (MotionForgeError,OSError,ValueError) as error:
            raise HTTPException(400,str(error)) from error

    def get_job(job_id):
        try:
            return repository.get(job_id)
        except (ValueError,FileNotFoundError):
            raise HTTPException(404,'Render job not found.')

    @app.get('/health')
    def health():
        return {'status':'ok'}

    @app.post('/validate')
    def validate(request:ProjectRequest):
        project=project_from(request)
        return {'valid':True,'project':project.document['id'],'frames':project.frame_count}

    @app.post('/preview')
    def preview(request:PreviewRequest):
        project=project_from(request)
        output=root/'output'/'previews'/f'{uuid4()}.png'
        try:
            PreviewService().preview(project,request.time,output)
        except (MotionForgeError,OSError,ValueError) as error:
            raise HTTPException(400,str(error)) from error
        return FileResponse(output,media_type='image/png')

    @app.post('/renders',status_code=202)
    def render(request:ProjectRequest):
        return jobs.submit(project_from(request))

    @app.get('/jobs/{job_id}')
    def status(job_id:str):
        return get_job(job_id)

    @app.get('/jobs/{job_id}/video')
    def video(job_id:str):
        job=get_job(job_id)
        if job['status']!='completed':
            raise HTTPException(409,f'Render status is {job["status"]}.')
        return FileResponse(repository.directory(job_id)/'video.mp4',media_type='video/mp4')
    return app
