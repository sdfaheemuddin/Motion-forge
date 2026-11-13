"""Layout reuse, active labels and continuous camera/content rendering."""
from copy import deepcopy
from pathlib import Path
import tempfile
import unittest
from motion_forge import load_project
from motion_forge.services.builder_service import BuilderService
from motion_forge.services.presentation_service import camera_rect, layout_elements
from motion_forge.renderers.frame_renderer import FrameRenderer

class PresentationTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.service=BuilderService(self.temp.name)
        self.bundle=self.service.create('Presentation test')
        d=self.bundle['documents'];p=d['project.json'];p['canvas']={'width':160,'height':100,'background':'#000000'};p['timeline'].update(duration=4,fps=10)
        d['layouts/default.json']={'id':'default-layout','name':'Reusable layout','viewport':{'x':0,'y':30,'width':80,'height':50},'elements':[{'id':'title','type':'text','binding':'title','text':'Default','size':10,'color':'#FFFFFF','transform':{'position':[0,0]}}],'navigation':{'items':[{'id':'a','label':'A'},{'id':'b','label':'B'}],'x':0,'y':90,'width':160,'size':8,'color':'#555555','activeColor':'#00FFFF','underline':True}}
        d['compositions/world.json']={'id':'world','name':'Shared world','canvas':{'width':160,'height':50},'elements':[{'id':'left','type':'shape','shape':'rectangle','width':80,'height':50,'fill':'#FF0000'},{'id':'right','type':'shape','shape':'rectangle','width':80,'height':50,'fill':'#00FF00','transform':{'position':[80,0]}},{'id':'point','type':'shape','shape':'circle','radius':2,'fill':'#FFFFFF'}]}
        d['scenes/main.json'].update(values={'title':'First'},activeNavigationItem='a',camera={'focus':{'x':0,'y':0,'width':80,'height':50},'transition':1,'fit':'fill'})
        d['scenes/second.json']={**deepcopy(d['scenes/main.json']),'id':'second','values':{'title':'Second'},'activeNavigationItem':'b','camera':{'focus':{'x':80,'y':0,'width':80,'height':50},'transition':1,'fit':'fill'}}
        p['scenes'].append('scenes/second.json')
        d['timeline.json']={'clips':[{'id':'first','scene':'main','start':0,'duration':2},{'id':'second-clip','scene':'second','start':2,'duration':2}],'paths':[{'id':'route','points':[[10,25],[150,25]]}],'tracks':[{'id':'travel','target':'world/point','animation':'followPath','start':0,'duration':4,'parameters':{'path':'route'}}]}

    def tearDown(self): self.temp.cleanup()

    def project(self):
        b=self.service.save(self.bundle['project'],self.bundle['documents'],self.bundle['revision'])
        return load_project(Path(self.temp.name)/b['project'])

    def test_reused_layout_changes_text_and_only_active_navigation(self):
        project=self.project();layout=project.layouts['default-layout']
        first=layout_elements(layout,project.scenes['main'],project.branding)
        second=layout_elements(layout,project.scenes['second'],project.branding)
        self.assertEqual(first[0]['text'],'First');self.assertEqual(second[0]['text'],'Second')
        self.assertEqual(next(e for e in first if e['id']=='nav-a')['color'],'#00FFFF')
        self.assertEqual(next(e for e in second if e['id']=='nav-a')['color'],'#555555')
        self.assertNotIn('nav-line-a',[e['id'] for e in second])
        layout['elements'][0]['transform']['position']=[5,4]
        for scene in project.scenes.values(): self.assertEqual(layout_elements(layout,scene,project.branding)[0]['transform']['position'],[5,4])

    def test_camera_is_continuous_stateless_and_only_changes_viewport(self):
        project=self.project();clip=project.timeline['clips'][1]
        self.assertEqual(camera_rect(project,clip,2)['x'],0)
        self.assertAlmostEqual(camera_rect(project,clip,2.5)['x'],40)
        self.assertEqual(camera_rect(project,clip,3)['x'],80)
        renderer=FrameRenderer(project)
        try:
            before=renderer.render(0);after=renderer.render(3);again=renderer.render(0)
            self.assertEqual(before.getpixel((10,40))[:3],(255,0,0));self.assertEqual(after.getpixel((10,40))[:3],(0,255,0))
            self.assertEqual(after.getpixel((100,40))[:3],(0,0,0))
            self.assertEqual(before.tobytes(),again.tobytes())
            point=project.compositions['world']['elements'][-1];global_clip={'id':'world','start':0,'duration':4}
            a=renderer.state(point,global_clip,1.999)['transform']['position'][0];b=renderer.state(point,global_clip,2.001)['transform']['position'][0]
            self.assertGreater(b,a);self.assertLess(b-a,.1)
        finally:renderer.close()

    def test_new_scene_format_exports_mp4(self):
        from motion_forge.services.render_service import RenderService
        project=self.project()
        output=Path(self.temp.name)/'presentation.mp4'
        manifest=RenderService().render(project,output)
        self.assertEqual(manifest['frames'],40)
        self.assertIn(b'ftyp',output.read_bytes()[:64])

    def test_invalid_references_rectangles_and_navigation_are_rejected(self):
        for key,value in [('layout','missing'),('composition','missing'),('activeNavigationItem','missing')]:
            d=deepcopy(self.bundle['documents']);d['scenes/main.json'][key]=value
            self.assertFalse(self.service.validate(self.bundle['project'],d)['valid'],key)
        d=deepcopy(self.bundle['documents']);d['scenes/main.json']['camera']['focus']['width']=999
        self.assertFalse(self.service.validate(self.bundle['project'],d)['valid'])
        d=deepcopy(self.bundle['documents']);d['scenes/main.json']['camera']['transition']=10
        self.assertFalse(self.service.validate(self.bundle['project'],d)['valid'])
