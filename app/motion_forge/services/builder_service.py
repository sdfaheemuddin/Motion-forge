"""Single-user project editing; rendering remains in the existing engine."""
from contextlib import contextmanager
from copy import deepcopy
import hashlib
from io import BytesIO
import json
import logging
import mimetypes
import os
from pathlib import Path
import re
import shutil
import tempfile
import threading
from urllib.parse import urlencode
from uuid import uuid4

from PIL import Image
from .. import load_project
from ..repositories.project_repository import read_json
from ..services.preview_service import PreviewService
from ..services.validation_service import ValidationService
from ..utils.errors import MotionForgeError, ValidationError

LOG=logging.getLogger(__name__)
MAX_UPLOAD_BYTES=100*1024*1024
ASSET_EXTENSIONS={
    'image':{'.png','.jpg','.jpeg','.webp','.gif'},
    'font':{'.ttf','.otf'},
    'audio':{'.wav','.mp3','.aac','.ogg','.flac','.m4a'},
    'video':{'.mp4','.mov','.mkv','.webm'},
    'path':{'.json'},
}

class ConflictError(MotionForgeError):
    """The on-disk project changed since the editor opened it."""

def slug(value):
    result=re.sub(r'[^a-z0-9]+','-',value.lower()).strip('-')[:64]
    return result if result and result[0].isalpha() else 'project-'+result

class BuilderService:
    def __init__(self,root):
        self.root=Path(root).resolve()
        self.cache=self.root/'cache'/'builder'
        self.cache.mkdir(parents=True,exist_ok=True)
        self.lock=threading.RLock()

    def project_file(self,reference,write=False):
        path=(self.root/reference).resolve()
        roots=['projects'] if write else ['projects','templates']
        if path.name!='project.json' or not any(path.is_relative_to(self.root/name) for name in roots):
            raise MotionForgeError('Choose a project.json inside projects/ or templates/. Templates must be copied before editing.')
        if not path.is_file():
            raise MotionForgeError(f'Project not found: {reference}')
        return path

    def config_file(self,directory,name):
        path=(directory/name).resolve()
        if not path.is_relative_to(directory) or path.suffix.lower()!='.json':
            raise MotionForgeError(f'Configuration reference must be a JSON file inside the project: {name}')
        return path

    def documents(self,path):
        entry=read_json(path)
        try:
            references=[entry['assets'],entry['timeline']['file'],entry['export'],*entry['scenes'],*entry.get('layouts',[]),*entry.get('compositions',[])]
            if entry.get('branding'):
                references.append(entry['branding'])
        except (KeyError,TypeError) as error:
            raise MotionForgeError(f'{path}: missing project configuration references') from error
        result={'project.json':entry}
        for reference in references:
            result[reference]=read_json(self.config_file(path.parent,reference))
        return result

    @staticmethod
    def revision(documents):
        content=json.dumps(documents,sort_keys=True,ensure_ascii=False,allow_nan=False)
        return hashlib.sha256(content.encode()).hexdigest()

    def asset_path(self,project_reference,source):
        entry=self.project_file(project_reference)
        path=(entry.parent/source).resolve()
        if not path.is_relative_to(self.root):
            raise MotionForgeError('Asset files must remain inside the application workspace.')
        if not path.is_file():
            raise MotionForgeError(f'Asset file not found: {source}')
        return path

    def metadata(self,reference,asset):
        result={'type':asset['type'],'source':asset['source']}
        if asset['source'].startswith('system:'):
            return result
        try:
            path=self.asset_path(reference,asset['source'])
            result['url']='/builder/asset?'+urlencode({'project':reference,'source':asset['source']})
            result['bytes']=path.stat().st_size
            if asset['type']=='image':
                with Image.open(path) as image:
                    result.update(width=image.width,height=image.height)
            elif asset['type']=='path':
                result['pathData']=read_json(path)
        except (MotionForgeError,OSError,ValueError) as error:
            result['error']=str(error)
        return result

    def bundle(self,reference):
        path=self.project_file(reference)
        documents=self.documents(path)
        assets=documents[documents['project.json']['assets']].get('assets',[])
        return {'project':path.relative_to(self.root).as_posix(),'revision':self.revision(documents),
                'readOnly':path.is_relative_to(self.root/'templates'),'documents':documents,
                'assetMetadata':{asset['id']:self.metadata(reference,asset) for asset in assets}}

    def list_projects(self,kind='projects'):
        result=[]
        if kind not in ('projects','templates'):
            raise MotionForgeError('Unknown project collection.')
        for path in sorted((self.root/kind).glob('*/project.json')):
            if not path.resolve().is_relative_to(self.root/kind):
                continue
            try:
                data=read_json(path)
                result.append({'project':path.relative_to(self.root).as_posix(),'id':data['id'],'name':data['name'],
                               'canvas':data['canvas'],'duration':data['timeline']['duration'],'fps':data['timeline']['fps'],
                               'modifiedAt':path.stat().st_mtime})
            except (MotionForgeError,KeyError,TypeError) as error:
                LOG.warning('Skipping unreadable project %s: %s',path,error)
        return result

    def _check_documents(self,directory,documents):
        if 'project.json' not in documents:
            raise MotionForgeError('The draft must include project.json.')
        ValidationService().validate_document(documents['project.json'],'project','project.json')
        entry=documents['project.json']
        expected={'project.json',entry['assets'],entry['timeline']['file'],entry['export'],*entry['scenes'],*entry.get('layouts',[]),*entry.get('compositions',[])}
        if entry.get('branding'):
            expected.add(entry['branding'])
        if set(documents)!=expected:
            missing=expected-set(documents);extra=set(documents)-expected
            raise MotionForgeError(f'Draft configuration files do not match project.json. Missing: {sorted(missing)}; unexpected: {sorted(extra)}')
        for name in documents:
            self.config_file(directory,name)

    @contextmanager
    def staged_project(self,reference,documents):
        original=self.project_file(reference)
        self._check_documents(original.parent,documents)
        draft=deepcopy(documents)
        entry=draft['project.json']
        # Staging must not change how project-relative assets resolve.
        for asset in draft[entry['assets']].get('assets',[]):
            if not asset['source'].startswith('system:'):
                asset['source']=str(self.asset_path(reference,asset['source']))
        with tempfile.TemporaryDirectory(prefix='draft-',dir=self.cache) as temporary:
            directory=Path(temporary)
            for name,data in draft.items():
                path=self.config_file(directory,name);path.parent.mkdir(parents=True,exist_ok=True)
                path.write_text(json.dumps(data,indent=2,allow_nan=False),encoding='utf-8')
            yield load_project(directory/'project.json')

    def validate(self,reference,documents):
        try:
            with self.staged_project(reference,documents) as project:
                return {'valid':True,'errors':[],'frames':project.frame_count}
        except ValidationError as error:
            return {'valid':False,'errors':error.errors}
        except (MotionForgeError,OSError,ValueError,KeyError,TypeError) as error:
            return {'valid':False,'errors':[str(error)]}

    def save(self,reference,documents,revision):
        with self.lock:
            path=self.project_file(reference,write=True)
            if revision!=self.revision(self.documents(path)):
                raise ConflictError('This project changed on disk. Reopen it before saving so external changes are preserved.')
            with self.staged_project(reference,documents):
                pass
            backup=self.cache/'backups'/str(uuid4());backup.mkdir(parents=True)
            originals={};written=[]
            try:
                # Write the entry file last so it only refers to completed configuration files.
                for name in sorted(documents,key=lambda name:name=='project.json'):
                    destination=self.config_file(path.parent,name)
                    originals[name]=destination.read_bytes() if destination.exists() else None
                    if originals[name] is not None:
                        saved=backup/name;saved.parent.mkdir(parents=True,exist_ok=True);saved.write_bytes(originals[name])
                    destination.parent.mkdir(parents=True,exist_ok=True)
                    temporary=destination.with_name(destination.name+'.'+uuid4().hex+'.tmp')
                    temporary.write_text(json.dumps(documents[name],indent=2,ensure_ascii=False,allow_nan=False)+'\n',encoding='utf-8')
                    os.replace(temporary,destination);written.append(name)
            except Exception:
                for name in reversed(written):
                    destination=self.config_file(path.parent,name)
                    if originals[name] is None:
                        destination.unlink(missing_ok=True)
                    else:
                        destination.write_bytes(originals[name])
                LOG.exception('Project save rolled back: %s',reference)
                raise
            LOG.info('Saved builder project %s',reference)
            return self.bundle(reference)

    def create(self,name,template=None,project_id=None):
        project_id=project_id or slug(name)
        if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_-]{0,63}',project_id):
            raise MotionForgeError('Project ID must start with a letter and contain only letters, numbers, hyphens or underscores.')
        with self.lock:
            destination=self.root/'projects'/project_id
            if destination.exists():
                raise ConflictError('That project ID already exists. Choose another ID.')
            destination.parent.mkdir(parents=True,exist_ok=True)
            try:
                if template:
                    source=self.project_file(template)
                    if not source.is_relative_to(self.root/'templates'):
                        raise MotionForgeError('Choose a template from templates/.')
                    source_docs=self.documents(source)
                    # Inspect all asset references before copying a template.
                    assets=source_docs[source_docs['project.json']['assets']].get('assets',[])
                    for asset in assets:
                        if not asset['source'].startswith('system:'):
                            self.asset_path(template,asset['source'])
                    if any(item.is_symlink() for item in source.parent.rglob('*')):
                        raise MotionForgeError('Templates containing symbolic links cannot be copied by the builder.')
                    shutil.copytree(source.parent,destination)
                    entry=read_json(destination/'project.json')
                    assets_document=read_json(destination/entry['assets'])
                    for asset in assets_document.get('assets',[]):
                        if asset['source'].startswith('system:'):
                            continue
                        original=(source.parent/asset['source']).resolve()
                        if not original.is_relative_to(source.parent):
                            asset['source']=os.path.relpath(original,destination).replace('\\','/')
                    (destination/entry['assets']).write_text(json.dumps(assets_document,indent=2),encoding='utf-8')
                else:
                    destination.mkdir()
                    entry={'schemaVersion':'1.0','id':project_id,'name':name,'canvas':{'width':1920,'height':1080,'background':'#0B1422'},
                           'timeline':{'duration':10,'fps':24,'file':'timeline.json'},'assets':'assets.json','branding':'branding.json',
                           'scenes':['scenes/main.json'],'export':'export.json'}
                    initial={'assets.json':{'assets':[]},'branding.json':{'colors':{'primary':'#51D6C3','text':'#F1F5F9'},'textStyles':{}},
                             'timeline.json':{'clips':[{'id':'main','scene':'main','start':0,'duration':10}],'tracks':[],'paths':[],'audio':[]},
                             'scenes/main.json':{'id':'main','elements':[{'id':'title','type':'text','text':'Your story starts here','size':72,'color':'#FFFFFF','transform':{'position':[120,200]}}]},
                             'export.json':{'filename':project_id+'.mp4','directory':'../../output/'+project_id,'video':{'codec':'h264','quality':18,'preset':'fast','pixelFormat':'yuv420p'},'audio':{'enabled':False},'loop':{'validateSeam':False}}}
                    entry['layouts']=['layouts/default.json'];entry['compositions']=['compositions/world.json']
                    initial['layouts/default.json']={'id':'default-layout','name':'Title and content','viewport':{'x':80,'y':350,'width':1760,'height':590},'elements':[{'id':'logo','type':'image','binding':'logo','width':240,'height':80,'transform':{'position':[100,30]}},{'id':'title','type':'text','binding':'title','text':'Your story starts here','size':68,'color':'#FFFFFF','width':1700,'transform':{'position':[100,170]}},{'id':'subtitle','type':'text','binding':'subtitle','text':'Add your message','size':30,'color':'#70E1C4','transform':{'position':[100,275]}}],'navigation':{'items':[{'id':'first','label':'FIRST'},{'id':'second','label':'SECOND'}],'x':100,'y':1010,'width':1720,'size':18,'color':'#718595','activeColor':'#70E1C4','underline':True}}
                    initial['compositions/world.json']={'id':'world','name':'Shared composition','canvas':{'width':1920,'height':1080},'elements':[{'id':'content','type':'text','text':'Add images and graphics in Layout Design','size':48,'color':'#FFFFFF','transform':{'position':[100,350]}}]}
                    initial['scenes/main.json']={'id':'main','elements':[],'layout':'default-layout','composition':'world','values':{'title':'Your story starts here','subtitle':'Add your message'},'activeNavigationItem':'','camera':{'focus':{'x':0,'y':0,'width':1920,'height':1080},'transition':1.3,'fit':'contain','easing':'easeInOut'}}
                    for file,data in initial.items():
                        target=destination/file;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(data,indent=2),encoding='utf-8')
                entry.update(id=project_id,name=name)
                (destination/'project.json').write_text(json.dumps(entry,indent=2),encoding='utf-8')
                export_path=destination/entry['export'];export=read_json(export_path)
                export.update(filename=project_id+'.mp4',directory='../../output/'+project_id)
                export_path.write_text(json.dumps(export,indent=2),encoding='utf-8')
                load_project(destination/'project.json')
            except Exception:
                if destination.exists():
                    shutil.rmtree(destination)
                raise
            LOG.info('Created project %s',project_id)
            return self.bundle((destination/'project.json').relative_to(self.root).as_posix())

    def upload(self,reference,filename,data):
        if not data or len(data)>MAX_UPLOAD_BYTES:
            raise MotionForgeError('Choose a non-empty asset smaller than 100 MB.')
        entry=self.project_file(reference,write=True)
        suffix=Path(filename).suffix.lower()
        kind=next((kind for kind,extensions in ASSET_EXTENSIONS.items() if suffix in extensions),None)
        if kind is None:
            raise MotionForgeError('Unsupported asset format. Use PNG/JPG/WebP/GIF, TTF/OTF, common audio/video formats, or path JSON.')
        if kind=='image':
            try:
                with Image.open(BytesIO(data)) as image:
                    image.verify()
            except (OSError,ValueError) as error:
                raise MotionForgeError('This file is not a readable image.') from error
        elif kind=='path':
            try:
                ValidationService().validate_document(json.loads(data),'pathdata',filename)
            except (ValueError,UnicodeError) as error:
                raise MotionForgeError('Path assets must contain valid JSON points or segments.') from error
        digest=hashlib.sha256(data).hexdigest()[:10]
        name=slug(Path(filename).stem)+'-'+digest+suffix
        source='assets/uploads/'+name
        with self.lock:
            destination=entry.parent/source;destination.parent.mkdir(parents=True,exist_ok=True)
            if not destination.exists():
                destination.write_bytes(data)
        asset={'id':slug(Path(filename).stem)+'-'+uuid4().hex[:6],'type':kind,'source':source}
        LOG.info('Imported %s asset into %s',kind,reference)
        return {'asset':asset,'metadata':self.metadata(reference,asset)}

    def preview(self,reference,documents,time):
        with self.staged_project(reference,documents) as project:
            output=project.root/'preview.png'
            PreviewService().preview(project,time,output)
            return output.read_bytes()
