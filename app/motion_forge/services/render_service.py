import json
import logging
import os
from pathlib import Path
import tempfile
import numpy as np
from PIL import Image
from ..renderers.frame_renderer import FrameRenderer
from ..infrastructure.ffmpeg.encoder import FrameEncoder, find_ffmpeg
from ..infrastructure.ffmpeg.audio_mixer import mix_audio
from ..utils.paths import project_path
from ..utils.errors import MotionForgeError

LOG=logging.getLogger(__name__)

class RenderService:
    def render(self,project,output=None,progress=None):
        find_ffmpeg()  # Fail before spending time rendering frames.
        destination=Path(output).expanduser().resolve() if output else project_path(project.root,project.export.get('directory','output'))/project.export['filename']
        destination.parent.mkdir(parents=True,exist_ok=True)
        if destination.suffix.lower()!='.mp4':
            raise MotionForgeError('Output filename must end in .mp4.')
        resolution=project.export.get('resolution',dict(zip(('width','height'),project.canvas_size)))
        size=resolution['width'],resolution['height']
        log_path=destination.with_suffix('.log')
        renderer=FrameRenderer(project)
        first=last=None
        # A failed render never overwrites an existing successful export.
        with tempfile.TemporaryDirectory(prefix='.motion-forge-',dir=destination.parent) as temporary:
            temporary=Path(temporary)
            encoded=temporary/'video.mp4'
            encoder=FrameEncoder(encoded,size,project.fps,project.export.get('video',{}),log_path)
            try:
                for index in range(project.frame_count):
                    image=renderer.render(index/project.fps)
                    if image.size!=size:
                        image=image.resize(size,Image.Resampling.LANCZOS)
                    if index==0:
                        first=image.copy()
                    if index==project.frame_count-1:
                        last=image.copy()
                    encoder.write(image)
                    if index % project.fps == 0 or index==project.frame_count-1:
                        LOG.info('Rendered frame %s/%s',index+1,project.frame_count)
                        if progress:
                            progress((index+1)/project.frame_count)
                encoder.finish()
                if project.export.get('audio',{}).get('enabled',False) and project.timeline.get('audio'):
                    mixed=temporary/'mixed.mp4'
                    mix_audio(project,encoded,mixed,log_path)
                    encoded=mixed
                os.replace(encoded,destination)
            except Exception:
                encoder.abort()
                LOG.exception('Render failed for %s',project.document['id'])
                raise
            finally:
                renderer.close()
        manifest={'project':project.document['id'],'output':str(destination),'frames':project.frame_count,
                  'fps':project.fps,'duration':project.frame_count/project.fps,'resolution':list(size)}
        if project.export.get('loop',{}).get('validateSeam',False):
            difference=np.abs(np.asarray(first.convert('RGB')).astype(float)-np.asarray(last.convert('RGB')).astype(float))
            mean=float(difference.mean()); maximum=float(difference.max())
            tolerance=project.export.get('loop',{}).get('tolerance',1)
            manifest['loopSeam']={'meanChannelDifference':mean,'maxChannelDifference':maximum,'tolerance':tolerance,'passes':mean<=tolerance}
            if mean>tolerance:
                LOG.warning('Loop endpoint difference %.3f exceeds tolerance %.3f; adjust project timing',mean,tolerance)
        destination.with_suffix('.manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
        LOG.info('Saved %s',destination)
        return manifest
