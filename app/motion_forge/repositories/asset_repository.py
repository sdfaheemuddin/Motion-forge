from PIL import Image, ImageFont
from ..utils.paths import project_path
from ..infrastructure.font_resolver import resolve_system_font
from ..infrastructure.ffmpeg.video_reader import VideoReader
from ..utils.errors import MotionForgeError
from .project_repository import read_json

class AssetRepository:
    def __init__(self,project):
        self.project=project
        self.images={}; self.fonts={}; self.videos={}; self.paths={}

    def source(self,asset_id):
        return self.project.assets[asset_id]['source']

    def image(self,asset_id):
        if asset_id not in self.images:
            path=project_path(self.project.root,self.source(asset_id))
            try:
                with Image.open(path) as image:
                    self.images[asset_id]=image.convert('RGBA')
            except OSError as error:
                raise MotionForgeError(f'Cannot open image asset {asset_id}: {path}: {error}') from error
        return self.images[asset_id]

    def font(self,asset_id,size):
        source=self.source(asset_id) if asset_id else 'system:sans'
        key=source,round(size)
        if key not in self.fonts:
            path=resolve_system_font(source.split(':',1)[1]) if source.startswith('system:') else str(project_path(self.project.root,source))
            try:
                self.fonts[key]=ImageFont.truetype(path,max(1,round(size)))
            except OSError as error:
                raise MotionForgeError(f'Cannot open font {path}: {error}') from error
        return self.fonts[key]

    def video(self,asset_id,time):
        if asset_id not in self.videos:
            self.videos[asset_id]=VideoReader(project_path(self.project.root,self.source(asset_id)))
        return self.videos[asset_id].frame(time)

    def path(self,asset_id):
        if asset_id not in self.paths:
            self.paths[asset_id]=read_json(project_path(self.project.root,self.source(asset_id)))
        return self.paths[asset_id]

    def close(self):
        for video in self.videos.values():
            video.close()
