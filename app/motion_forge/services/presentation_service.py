"""Resolve reusable layouts, scene content, and stateless camera movement."""
from copy import deepcopy
from dataclasses import replace
from ..utils.errors import ValidationError


def layout_elements(layout,scene,branding):
    """Bindings change content; the reusable layout owns position and appearance."""
    values=scene.get('values',{})
    def resolve(items):
        result=[]
        for original in items:
            item=deepcopy(original)
            binding=item.pop('binding',None)
            if binding:
                value=values.get(binding,branding.get('logo','') if binding=='logo' else item.get('text',''))
                if item['type']=='text': item['text']=value
                elif item['type'] in ('image','video'):
                    if not value: continue
                    item['asset']=value
            if 'children' in item: item['children']=resolve(item['children'])
            result.append(item)
        return result
    result=resolve(layout['elements'])
    nav=layout.get('navigation',{});items=nav.get('items',[])
    for index,item in enumerate(items):
        active=scene.get('activeNavigationItem','') in (item['id'],'*')
        width=nav.get('width',1600)/max(1,len(items));x=nav.get('x',80)+index*width;y=nav.get('y',960)
        color=nav.get('activeColor','#70E1C4') if active else nav.get('color','#718595')
        result.append({'id':'nav-'+item['id'],'type':'text','text':item['label'],'size':nav.get('size',18),'color':color,'width':max(1,width-12),'transform':{'position':[x,y]},**({'font':nav['font']} if nav.get('font') else {})})
        if active and nav.get('underline',True):
            result.append({'id':'nav-line-'+item['id'],'type':'shape','shape':'rectangle','width':max(1,width-18),'height':3,'fill':color,'transform':{'position':[x,y-13]}})
    return result


def adjusted_focus(focus,viewport,fit='fill'):
    """Fit/Fill alter the sampled rectangle, never stretch the source."""
    rect=dict(focus);ratio=viewport['width']/viewport['height'];source=rect['width']/rect['height']
    width,height=rect['width'],rect['height']
    if (source>ratio)==(fit=='fill'): width=height*ratio
    else: height=width/ratio
    return {'x':rect['x']+(rect['width']-width)/2,'y':rect['y']+(rect['height']-height)/2,'width':width,'height':height}


def scene_focus(project,scene,viewport):
    composition=project.compositions[scene['composition']]
    return adjusted_focus(scene.get('camera',{}).get('focus',{'x':0,'y':0,**composition['canvas']}),viewport,scene.get('camera',{}).get('fit','fill'))


def camera_rect(project,clip,time):
    scene=project.scenes[clip['scene']];viewport=project.layouts[scene['layout']]['viewport']
    target=scene_focus(project,scene,viewport);camera=scene.get('camera',{})
    previous=[c for c in project.timeline['clips'] if c['id']!=clip['id'] and c['start']+c['duration']<=clip['start']+1e-6 and project.scenes[c['scene']].get('composition')==scene['composition']]
    if not previous: return target
    last=max(previous,key=lambda c:c['start']+c['duration']);origin=scene_focus(project,project.scenes[last['scene']],viewport)
    duration=camera.get('transition',1.3);t=min(1,max(0,(time-clip['start'])/duration)) if duration else 1
    easing=camera.get('easing','easeInOut')
    if easing=='easeInOut': t=t*t*(3-2*t)
    elif easing=='easeIn': t=t*t
    elif easing=='easeOut': t=1-(1-t)**2
    return {key:origin[key]+(target[key]-origin[key])*t for key in target}


def validate_presentation(project,validator):
    """Validate expanded overlays plus virtual composition targets without rendering them twice."""
    errors=[];scenes={};clips=deepcopy(project.timeline['clips']);all_ids=set(project.scenes)|set(project.layouts)|set(project.compositions)
    if len(all_ids)!=len(project.scenes)+len(project.layouts)+len(project.compositions): errors.append('Scene, layout and composition IDs must be distinct.')
    for key,layout in project.layouts.items():
        viewport=layout['viewport'];width,height=project.canvas_size
        if viewport['x']+viewport['width']>width+1e-6 or viewport['y']+viewport['height']>height+1e-6: errors.append(f'layout:{key}/viewport: rectangle must fit inside the project canvas')
        ids=[item['id'] for item in layout.get('navigation',{}).get('items',[])]
        if len(ids)!=len(set(ids)): errors.append(f'layout:{key}/navigation: item IDs must be unique')
        # Validate unused layout styles and assets too.
        virtual='validation-layout-'+key
        scenes[virtual]={'id':virtual,'elements':layout_elements(layout,{},project.branding)}
        clips.append({'id':virtual,'scene':virtual,'start':0,'duration':project.duration})
    for key,scene in project.scenes.items():
        if 'layout' not in scene: scenes[key]=scene;continue
        if scene['layout'] not in project.layouts: errors.append(f'scene:{key}/layout: unknown layout {scene["layout"]}');continue
        if scene['composition'] not in project.compositions: errors.append(f'scene:{key}/composition: unknown composition {scene["composition"]}');continue
        layout=project.layouts[scene['layout']];active=scene.get('activeNavigationItem','')
        if active not in ('','*',*[item['id'] for item in layout.get('navigation',{}).get('items',[])]): errors.append(f'scene:{key}/activeNavigationItem: unknown navigation item {active}')
        focus=scene.get('camera',{}).get('focus');canvas=project.compositions[scene['composition']]['canvas']
        if focus and (focus['x']+focus['width']>canvas['width']+1e-6 or focus['y']+focus['height']>canvas['height']+1e-6): errors.append(f'scene:{key}/camera/focus: rectangle must fit inside the composition')
        for clip in project.timeline['clips']:
            if clip['scene']==key and scene.get('camera',{}).get('transition',0)>clip['duration']: errors.append(f'scene:{key}/camera/transition: movement cannot exceed scene duration')
        scenes[key]={'id':key,'elements':layout_elements(layout,scene,project.branding)}
    ids={clip['id'] for clip in clips}
    for key,composition in project.compositions.items():
        if key in ids: errors.append(f'composition:{key}: ID must not match a timeline clip ID')
        virtual='validation-content-'+key;scenes[virtual]={'id':virtual,'elements':composition['elements']}
        clips.append({'id':key,'scene':virtual,'start':0,'duration':project.duration})
    if errors: raise ValidationError(errors)
    validator.validate_project(replace(project,scenes=scenes,timeline={**project.timeline,'clips':clips}))
