from pathlib import Path
from ..renderers.frame_renderer import FrameRenderer
from ..utils.paths import project_path
from ..utils.errors import MotionForgeError

class PreviewService:
    def preview(self,project,time=0,output=None):
        if not 0<=time<project.duration:
            raise MotionForgeError(f'Preview time must be at least 0 and less than {project.duration} seconds.')
        destination=Path(output).expanduser().resolve() if output else project_path(project.root,project.export.get('directory','output'))/f'preview-{time:g}.png'
        destination.parent.mkdir(parents=True,exist_ok=True)
        if destination.suffix.lower()!='.png':
            raise MotionForgeError('Preview filename must end in .png.')
        renderer=FrameRenderer(project)
        try:
            renderer.render(time).save(destination)
        finally:
            renderer.close()
        return destination
