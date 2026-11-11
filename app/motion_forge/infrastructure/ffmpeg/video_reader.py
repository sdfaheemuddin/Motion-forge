import subprocess
from PIL import Image
from .encoder import find_ffmpeg, probe_video
from ...utils.errors import MotionForgeError

class VideoReader:
    """Sequential decoder with deterministic restart when a preview seeks backward."""
    def __init__(self,path):
        self.path=path
        self.width,self.height,self.fps=probe_video(path)
        self.process=None
        self.index=-1
        self.last=None

    def frame(self,time):
        desired=max(0,int(time*self.fps+1e-8))
        if self.process is None or desired < self.index:
            self.close()
            self.process=subprocess.Popen([find_ffmpeg(),'-v','error','-i',str(self.path),'-an',
                                           '-f','rawvideo','-pix_fmt','rgba','-vsync','0','-'],
                                          stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
            self.index=-1;self.last=None
        while self.index < desired:
            needed=self.width*self.height*4
            chunks=bytearray()
            while len(chunks)<needed:
                data=self.process.stdout.read(needed-len(chunks))
                if not data:
                    break
                chunks.extend(data)
            if len(chunks)!=needed:
                if self.last is None:
                    raise MotionForgeError(f'Cannot decode video: {self.path}')
                break
            self.index+=1
            self.last=Image.frombytes('RGBA',(self.width,self.height),bytes(chunks))
        return self.last.copy()

    def close(self):
        if self.process is not None:
            if self.process.poll() is None:
                self.process.kill()
            self.process.communicate()
            self.process=None
