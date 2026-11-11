"""Public Python API for Motion Forge."""
__version__ = "0.1.0"

def load_project(path):
    from .repositories.project_repository import ProjectRepository
    return ProjectRepository().load(path)

def render_project(path, output=None):
    from .services.render_service import RenderService
    return RenderService().render(load_project(path), output=output)

def preview_project(path, time=0, output=None):
    from .services.preview_service import PreviewService
    return PreviewService().preview(load_project(path), time, output)
