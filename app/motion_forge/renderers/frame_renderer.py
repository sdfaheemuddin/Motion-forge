from copy import deepcopy
import json
from PIL import Image, ImageColor
from ..engine.timeline import Timeline
from ..engine.transforms import place
from ..repositories.asset_repository import AssetRepository
from ..effects.registry import EFFECTS
from ..effects import builtin  # Register built-in effects.
from ..utils.paths import resource_directory
from ..utils.errors import MotionForgeError
from .registry import RENDERERS
from . import builtin as builtin_renderers

class FrameRenderer:
    """Render an arbitrary timestamp without depending on previous rendered frames."""
    def __init__(self,project):
        self.project=project
        self.assets=AssetRepository(project)
        self.timeline=Timeline(project.timeline)
        self.size=project.canvas_size
        self.defaults=json.loads((resource_directory('config')/'defaults.json').read_text())

    def color(self,value):
        if value.startswith('$colors.'):
            name=value.split('.',1)[1]
            if name not in self.project.branding.get('colors',{}):
                raise MotionForgeError(f'Unknown branding colour: {value}')
            value=self.project.branding['colors'][name]
        try:
            return ImageColor.getcolor(value,'RGBA')
        except ValueError as error:
            raise MotionForgeError(f'Invalid colour {value}') from error

    def state(self,element,clip,time):
        state=deepcopy(element)
        state['transform']={**self.defaults['transform'],**element.get('transform',{})}
        style=self.project.branding.get('textStyles',{}).get(element.get('style'),{})
        state={**self.defaults['text'],**style,**state}
        for name,value in self.timeline.values(f'{clip["id"]}/{element["id"]}',time).items():
            if name in state['transform']:
                state['transform'][name]=value
            elif name.startswith('effects.'):
                _,index,key=name.split('.')
                state['effects'][int(index)][key]=value
            else:
                state[name]=value
        return state

    def render(self,time):
        output=Image.new('RGBA',self.size,self.color(self.project.document['canvas'].get('background','#000000')))
        for clip in sorted(self.project.timeline['clips'],key=lambda item:item.get('layer',0)):
            if clip['start']<=time<clip['start']+clip['duration']:
                scene=self.project.scenes[clip['scene']]
                for element in sorted(scene['elements'],key=lambda item:item.get('layer',0)):
                    output.alpha_composite(self.element(element,clip,time))
        return output

    def element(self,element,clip,time,trail=True,canvas_size=None):
        canvas_size=canvas_size or self.size
        visibility=element.get('visibility',{})
        if not (clip['start']<=time<clip['start']+clip['duration'] and visibility.get('start',clip['start'])<=time<visibility.get('end',clip['start']+clip['duration'])):
            return Image.new('RGBA',canvas_size)
        state=self.state(element,clip,time)
        state['_canvas_size']=canvas_size
        if state['transform']['opacity']<=0:
            return Image.new('RGBA',canvas_size)
        surface=self.surface(state,clip,time)
        original_size=surface.size
        reveal=max(0,min(1,state.get('reveal',1)))
        if reveal<1:
            surface=surface.copy()
            surface.paste((0,0,0,0),(round(surface.width*reveal),0,surface.width,surface.height))
        offset=[0,0]
        for effect in state.get('effects',[]):
            if effect['type']=='trail':
                continue
            resolved=dict(effect)
            if 'color' in resolved:
                resolved['color']='#'+''.join(f'{v:02x}' for v in self.color(resolved['color']))
            surface,adjustment=EFFECTS.get(effect['type'])(surface,resolved)
            offset=[a+b for a,b in zip(offset,adjustment)]
        output=Image.new('RGBA',canvas_size)
        if trail:
            for effect in state.get('effects',[]):
                if effect['type']!='trail':
                    continue
                samples=effect.get('samples',8)
                for index in range(samples,0,-1):
                    earlier=time-effect.get('duration',0.4)*index/samples
                    ghost=self.element(element,clip,earlier,False,canvas_size)
                    alpha=effect.get('intensity',0.55)*(1-index/(samples+1))
                    ghost.putalpha(ghost.getchannel('A').point(lambda value:round(value*alpha)))
                    output.alpha_composite(ghost)
        output.alpha_composite(place(surface,canvas_size,state['transform'],original_size,offset))
        return output

    def surface(self,state,clip,time):
        return RENDERERS.get(state['type'])(self,state,clip,time)

    def close(self):
        self.assets.close()
