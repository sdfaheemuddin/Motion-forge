import json
import logging
from pathlib import Path
from ..models.project import Project
from ..utils.paths import project_path
from ..utils.errors import MotionForgeError

LOG = logging.getLogger(__name__)

def read_json(path):
    try:
        return json.loads(path.read_text(encoding='utf-8-sig'))
    except FileNotFoundError as error:
        raise MotionForgeError(f"JSON file not found: {path}") from error
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise MotionForgeError(f"Cannot read JSON {path}: {error}") from error

class ProjectRepository:
    def load(self, path):
        from ..services.validation_service import ValidationService
        from ..plugins.loader import load_plugins
        load_plugins()
        path = Path(path).expanduser().resolve()
        LOG.info('Loading project %s', path)
        document = read_json(path)
        validator = ValidationService()
        validator.validate_document(document, 'project', path)
        root = path.parent
        sources = {'project': path}
        def load_reference(reference, schema):
            source = project_path(root, reference)
            data = read_json(source)
            validator.validate_document(data, schema, source)
            sources[str(source)] = data
            return data
        asset_document = load_reference(document['assets'], 'assets')
        branding = load_reference(document['branding'], 'branding') if document.get('branding') else {}
        timeline = load_reference(document['timeline']['file'], 'timeline')
        export = load_reference(document['export'], 'export')
        scenes = {}
        for reference in document['scenes']:
            scene = load_reference(reference, 'scene')
            if scene['id'] in scenes:
                raise MotionForgeError(f"Duplicate scene ID '{scene['id']}' in {reference}")
            scenes[scene['id']] = scene
        assets = {}
        for asset in asset_document['assets']:
            if asset['id'] in assets:
                raise MotionForgeError(f"Duplicate asset ID '{asset['id']}' in {document['assets']}")
            assets[asset['id']] = asset
            if asset['type']=='path':
                source=project_path(root,asset['source'])
                validator.validate_document(read_json(source),'pathdata',source)
        project = Project(root, document, assets, branding, scenes, timeline, export, sources)
        validator.validate_project(project)
        return project
