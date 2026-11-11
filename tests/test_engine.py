import copy
import json
import math
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import numpy as np
from PIL import Image
from motion_forge import load_project
from motion_forge.engine.timeline import Timeline
from motion_forge.engine.interpolation import interpolate
from motion_forge.engine.paths import path_sample
from motion_forge.renderers.frame_renderer import FrameRenderer
from motion_forge.services.validation_service import ValidationService
from motion_forge.services.render_service import RenderService
from motion_forge.services.preview_service import PreviewService
from motion_forge.infrastructure.ffmpeg.encoder import find_ffmpeg, probe_video
from motion_forge.utils.errors import MotionForgeError, ValidationError

ROOT=Path(__file__).resolve().parents[1]

class EngineTests(unittest.TestCase):
    def setUp(self):
        self.project=load_project(ROOT/'projects/quick-start/project.json')

    def test_continuous_constant_speed_through_corner_and_caption_change(self):
        timeline=Timeline({'paths':[{'id':'route','points':[[0,0],[100,0],[100,200]]}],
                           'tracks':[{'id':'move','target':'clip/point','animation':'followPath','start':0,'duration':3,
                                      'parameters':{'path':'route'},'repeat':0}]})
        points=[timeline.values('clip/point',i/100)['position'] for i in range(301)]
        distances=[math.dist(a,b) for a,b in zip(points,points[1:])]
        self.assertLessEqual(max(distances),1.000001)
        self.assertEqual(points[100],[100,0])
        self.assertEqual(points[-1],[100,200])
        self.assertEqual(timeline.values('clip/point',20)['position'],[100,200])

    def test_keyframes_hold_and_sequential_tracks_take_over(self):
        timeline=Timeline({'tracks':[
            {'id':'in','target':'clip/item','property':'opacity','keyframes':[{'time':2,'value':0},{'time':3,'value':1}]},
            {'id':'out','target':'clip/item','property':'opacity','keyframes':[{'time':5,'value':1},{'time':6,'value':0}]}]})
        self.assertEqual(timeline.values('clip/item',0)['opacity'],0)
        self.assertEqual(timeline.values('clip/item',4)['opacity'],1)
        self.assertAlmostEqual(timeline.values('clip/item',5.5)['opacity'],0.5)
        self.assertEqual(timeline.values('clip/item',8)['opacity'],0)

    def test_explicit_repeat_only(self):
        track={'id':'move','target':'clip/item','animation':'slideIn','start':0,'duration':1,'repeat':1,
               'parameters':{'from':[0,0],'to':[100,0]}}
        timeline=Timeline({'tracks':[track]})
        self.assertEqual(timeline.values('clip/item',1.25)['position'],[25,0])
        self.assertEqual(timeline.values('clip/item',2)['position'],[100,0])

    def test_color_and_vector_interpolation(self):
        self.assertEqual(interpolate([0,10],[10,20],0.5),[5,15])
        self.assertEqual(interpolate('#000000','#ffffff',0.5),'#808080ff')

    def test_conflicting_tracks_rejected_but_independent_properties_allowed(self):
        project=copy.deepcopy(self.project)
        track=copy.deepcopy(project.timeline['tracks'][0])
        track['id']='conflicting'
        project.timeline['tracks'].append(track)
        with self.assertRaisesRegex(ValidationError,'conflicting writes'):
            ValidationService().validate_project(project)
        project.timeline['tracks'][-1]={'id':'independent','target':'demo/point','property':'opacity',
                                      'keyframes':[{'time':0,'value':0},{'time':4,'value':1}]}
        ValidationService().validate_project(project)

    def test_missing_asset_bad_target_and_duplicate_times_reported(self):
        project=copy.deepcopy(self.project)
        project.assets['missing']={'id':'missing','type':'image','source':'does-not-exist.png'}
        project.timeline['tracks'][0]['target']='demo/unknown'
        project.timeline['tracks'][1]['keyframes'][1]['time']=0
        with self.assertRaises(ValidationError) as raised:
            ValidationService().validate_project(project)
        self.assertIn('file not found',str(raised.exception))
        self.assertIn('unknown target',str(raised.exception))
        self.assertIn('strictly increasing',str(raised.exception))

    def test_json_schema_rejects_unknown_fields(self):
        document=copy.deepcopy(self.project.document);document['framRate']=24
        with self.assertRaisesRegex(ValidationError,'framRate'):
            ValidationService().validate_document(document,'project','project.json')

    def test_unsupported_keyframe_repeat_is_rejected(self):
        document=copy.deepcopy(self.project.timeline)
        document['tracks'][1]['repeat']=1
        with self.assertRaises(ValidationError):
            ValidationService().validate_document(document,'timeline','timeline.json')

    def test_preview_seek_is_stateless(self):
        renderer=FrameRenderer(self.project)
        try:
            first=np.asarray(renderer.render(1)).copy()
            renderer.render(3)
            self.assertTrue(np.array_equal(first,np.asarray(renderer.render(1))))
        finally:
            renderer.close()

    def test_group_transform_and_effect_padding_preserve_anchor(self):
        project=copy.deepcopy(self.project)
        project.document['canvas']={'width':160,'height':120,'background':'#000000'}
        project.scenes={'main':{'id':'main','elements':[{'id':'group','type':'group','transform':{'position':[50,20]},
            'children':[{'id':'circle','type':'shape','shape':'circle','radius':5,'fill':'#FFFFFF',
                         'transform':{'position':[10,20],'anchor':[0.5,0.5]},
                         'effects':[{'type':'glow','radius':4,'color':'#00FFFF','intensity':1}]}]}]}}
        project.timeline={'clips':[{'id':'clip','scene':'main','start':0,'duration':4}],'tracks':[]}
        renderer=FrameRenderer(project)
        try:
            image=renderer.render(1)
            self.assertEqual(image.getpixel((60,40))[:3],(255,255,255))
            self.assertEqual(image.getpixel((10,20))[:3],(0,0,0))
        finally:
            renderer.close()

    def test_preview_invalid_time(self):
        with self.assertRaisesRegex(MotionForgeError,'Preview time'):
            PreviewService().preview(self.project,40)

    def test_large_group_canvas_can_scale_children_into_project(self):
        project=copy.deepcopy(self.project)
        project.document['canvas']={'width':100,'height':100,'background':'#000000'}
        project.scenes={'main':{'id':'main','elements':[{'id':'group','type':'group','width':400,'height':400,
            'transform':{'scale':[0.25,0.25]},'children':[{'id':'tile','type':'shape','shape':'rectangle',
            'width':40,'height':40,'fill':'#FFFFFF','transform':{'position':[200,200]}}]}]}}
        project.timeline={'clips':[{'id':'clip','scene':'main','start':0,'duration':4}]}
        renderer=FrameRenderer(project)
        try:
            self.assertEqual(renderer.render(1).getpixel((55,55))[:3],(255,255,255))
        finally:
            renderer.close()

    def test_path_bezier_has_exact_endpoints(self):
        path={'type':'bezier','points':[[0,0],[20,0],[20,20],[40,20]]}
        self.assertEqual(path_sample(path,0)[0],[0,0])
        self.assertEqual(path_sample(path,1)[0],[40,20])

    def test_pvinsight_example_and_transparent_verticals(self):
        project=load_project(ROOT/'projects/pvinsight-blueprint/project.json')
        self.assertEqual(project.frame_count,960)
        for path in (project.root/'assets/verticals').glob('*.png'):
            with Image.open(path) as image:
                self.assertEqual(image.mode,'RGBA')
                self.assertEqual(image.getchannel('A').getextrema(),(0,255))

class ExportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            find_ffmpeg()
        except MotionForgeError:
            raise unittest.SkipTest('FFmpeg is unavailable')

    def test_render_video_audio_and_video_input(self):
        project=load_project(ROOT/'projects/quick-start/project.json')
        project.document['canvas'].update(width=160,height=120)
        project.document['timeline'].update(duration=1,fps=8)
        project.scenes={'main':{'id':'main','elements':[{'id':'tile','type':'shape','shape':'rectangle','width':30,'height':30,
                                                      'fill':'#FF0000','transform':{'position':[20,30]}}]}}
        project.timeline={'clips':[{'id':'clip','scene':'main','start':0,'duration':1}]}
        with tempfile.TemporaryDirectory() as temporary:
            temporary=Path(temporary)
            first=temporary/'first.mp4'
            manifest=RenderService().render(project,first)
            self.assertEqual(manifest['frames'],8)
            self.assertEqual(probe_video(first)[:2],(160,120))
            audio=temporary/'tone.wav'
            subprocess.run([find_ffmpeg(),'-v','error','-y','-f','lavfi','-i','sine=frequency=440:duration=1',str(audio)],check=True)
            project.assets.update({'clip':{'id':'clip','type':'video','source':str(first)},'tone':{'id':'tone','type':'audio','source':str(audio)}})
            project.scenes['main']['elements']=[{'id':'video','type':'video','asset':'clip'}]
            project.timeline['audio']=[{'id':'music','asset':'tone','start':0,'duration':1,'volume':0.2,'fadeOut':0.1}]
            project.export['audio']={'enabled':True}
            output=temporary/'mixed.mp4'
            RenderService().render(project,output)
            # Decode the mixed export to verify both video and audio streams.
            result=subprocess.run([find_ffmpeg(),'-v','error','-i',str(output),'-map','0:a:0','-f','null','-'],capture_output=True)
            self.assertEqual(result.returncode,0,result.stderr.decode())
            renderer=FrameRenderer(project)
            try:
                renderer.render(0.75)
                self.assertGreater(renderer.render(0).getpixel((30,40))[0],200)
            finally:
                renderer.close()

    def test_failed_render_preserves_existing_file(self):
        project=load_project(ROOT/'projects/quick-start/project.json')
        with tempfile.TemporaryDirectory() as temporary:
            output=Path(temporary)/'video.mp4';output.write_bytes(b'previous successful export')
            with patch.object(FrameRenderer,'render',side_effect=MotionForgeError('Deliberate frame failure')):
                with self.assertRaisesRegex(MotionForgeError,'Deliberate'):
                    RenderService().render(project,output)
            self.assertEqual(output.read_bytes(),b'previous successful export')

if __name__=='__main__':
    unittest.main()
