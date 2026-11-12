"""HTTP boundary for the local editor; business operations live in BuilderService."""
from typing import Any
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from ..services.builder_service import BuilderService, ConflictError, ASSET_EXTENSIONS, MAX_UPLOAD_BYTES
from ..utils.errors import MotionForgeError, ValidationError

LOG=logging.getLogger(__name__)

class DraftRequest(BaseModel):
    project: str
    documents: dict[str,Any]
    revision: str=''

class FrameRequest(DraftRequest):
    time: float=0

class CreateRequest(BaseModel):
    name: str=Field(min_length=1,max_length=150)
    template: str|None=None
    project_id: str|None=None

def builder_router(root,repository):
    service=BuilderService(root)
    router=APIRouter(prefix='/builder',tags=['Video builder'])

    def call(function,*args,**kwargs):
        try:
            return function(*args,**kwargs)
        except ConflictError as error:
            raise HTTPException(409,str(error)) from error
        except ValidationError as error:
            raise HTTPException(422,{'message':'Project validation failed','errors':error.errors}) from error
        except (MotionForgeError,OSError,ValueError,KeyError,TypeError) as error:
            LOG.warning('Builder request failed: %s',error)
            raise HTTPException(400,str(error)) from error

    @router.get('/projects')
    def projects():
        return {'projects':call(service.list_projects)}

    @router.get('/templates')
    def templates():
        return {'templates':call(service.list_projects,'templates')}

    @router.get('/project')
    def project(project:str):
        return call(service.bundle,project)

    @router.post('/projects',status_code=201)
    def create(request:CreateRequest):
        return call(service.create,request.name,request.template,request.project_id)

    @router.put('/project')
    def save(request:DraftRequest):
        return call(service.save,request.project,request.documents,request.revision)

    @router.post('/validate')
    def validate(request:DraftRequest):
        return service.validate(request.project,request.documents)

    @router.post('/preview')
    def preview(request:FrameRequest):
        data=call(service.preview,request.project,request.documents,request.time)
        return Response(content=data,media_type='image/png')

    @router.post('/assets',status_code=201)
    async def upload(request:Request,project:str,filename:str):
        if int(request.headers.get('content-length','0'))>MAX_UPLOAD_BYTES:
            raise HTTPException(413,'Asset is larger than 100 MB.')
        data=bytearray()
        async for chunk in request.stream():
            data.extend(chunk)
            if len(data)>MAX_UPLOAD_BYTES:
                raise HTTPException(413,'Asset is larger than 100 MB.')
        return call(service.upload,project,filename,bytes(data))

    @router.get('/asset')
    def asset(project:str,source:str):
        path=call(service.asset_path,project,source)
        if path.suffix.lower() not in set().union(*ASSET_EXTENSIONS.values()):
            raise HTTPException(400,'This file is not a supported media asset.')
        return FileResponse(path,headers={'Cache-Control':'private, max-age=3600'})

    @router.get('/jobs')
    def jobs():
        results=[]
        for path in repository.root.glob('*/job.json'):
            try:
                results.append(repository.get(path.parent.name))
            except (ValueError,OSError):
                continue
        return {'jobs':sorted(results,key=lambda job:job.get('createdAt',''),reverse=True)}

    return router
