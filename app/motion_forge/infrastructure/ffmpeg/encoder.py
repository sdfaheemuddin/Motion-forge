import json
import logging
import os
from pathlib import Path
import re
import shutil
import subprocess
from ...utils.errors import MotionForgeError

LOG = logging.getLogger(__name__)

def find_ffmpeg():
    configured = os.environ.get('MOTION_FORGE_FFMPEG')
    if configured:
        resolved = shutil.which(configured) or (configured if Path(configured).is_file() else None)
        if not resolved:
            raise MotionForgeError(f'MOTION_FORGE_FFMPEG executable not found: {configured}')
        return resolved
    executable = shutil.which('ffmpeg')
    if executable:
        return executable
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except (ImportError, RuntimeError) as error:
        raise MotionForgeError('FFmpeg is unavailable. Run: python -m pip install imageio-ffmpeg, or put ffmpeg on PATH.') from error

def probe_video(path):
    probe = shutil.which('ffprobe')
    if probe:
        process = subprocess.run([probe,'-v','error','-select_streams','v:0','-show_entries',
                                  'stream=width,height,r_frame_rate:format=duration','-of','json',str(path)],capture_output=True,text=True)
        try:
            metadata = json.loads(process.stdout)
            stream = metadata['streams'][0]
            numerator, denominator = map(float,stream['r_frame_rate'].split('/'))
            return stream['width'], stream['height'], numerator/denominator
        except (ValueError, KeyError, IndexError, ZeroDivisionError):
            raise MotionForgeError(f'Cannot inspect video {path}: {process.stderr[-1000:]}')
    process = subprocess.run([find_ffmpeg(),'-hide_banner','-i',str(path)],capture_output=True,text=True)
    video_line = next((line for line in process.stderr.splitlines() if 'Video:' in line),'')
    dimensions = re.search(r'\b(\d{2,6})x(\d{2,6})\b',video_line)
    fps = re.search(r'([\d.]+) fps',video_line)
    if not dimensions or not fps:
        raise MotionForgeError(f'Cannot inspect video {path}: {process.stderr[-1000:]}')
    return int(dimensions[1]),int(dimensions[2]),float(fps[1])

def run_ffmpeg(arguments, log_path):
    with open(log_path,'ab') as log:
        process = subprocess.run([find_ffmpeg(),'-hide_banner','-loglevel','error','-y',*map(str,arguments)],stderr=log)
    if process.returncode:
        detail=Path(log_path).read_text(errors='replace')[-2000:]
        raise MotionForgeError(f'FFmpeg failed. Details in {log_path}: {detail}')

class FrameEncoder:
    def __init__(self, path, size, fps, settings, log_path):
        self.log_path = log_path
        self.log = open(log_path,'ab')
        command = [find_ffmpeg(),'-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24',
                   '-s',f'{size[0]}x{size[1]}','-r',str(fps),'-i','-','-an','-c:v','libx264',
                   '-preset',settings.get('preset','fast'),'-crf',str(settings.get('quality',18)),
                   '-pix_fmt','yuv420p','-movflags','+faststart',str(path)]
        LOG.info('Starting FFmpeg export: %s',path)
        self.process = subprocess.Popen(command,stdin=subprocess.PIPE,stderr=self.log)

    def write(self, image):
        try:
            self.process.stdin.write(image.convert('RGB').tobytes())
        except BrokenPipeError as error:
            self.abort()
            raise MotionForgeError(f'FFmpeg stopped accepting frames. Check {self.log_path}') from error

    def finish(self):
        self.process.stdin.close()
        code=self.process.wait()
        self.log.close()
        if code:
            raise MotionForgeError(f'FFmpeg export failed. Check {self.log_path}')

    def abort(self):
        if self.process.poll() is None:
            self.process.kill()
        self.process.wait()
        if self.process.stdin and not self.process.stdin.closed:
            self.process.stdin.close()
        if not self.log.closed:
            self.log.close()
