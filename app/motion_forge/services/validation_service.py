import json
import math
from jsonschema import Draft202012Validator
from ..utils.paths import resource_directory, project_path
from ..utils.errors import ValidationError
from ..engine.timeline import interval
from ..engine.paths import path_points
from ..animations.presets import ANIMATIONS, writes
from ..renderers.registry import RENDERERS
from ..effects.registry import EFFECTS
from PIL import ImageColor

def elements(scene):
    def walk(items):
        for item in items:
            yield item
            yield from walk(item.get('children', []))
    return list(walk(scene['elements']))

class ValidationService:
    def validate_document(self, document, kind, source):
        schema = json.loads((resource_directory('schemas') / f'{kind}.schema.json').read_text())
        errors = []
        for error in Draft202012Validator(schema).iter_errors(document):
            pointer = '/' + '/'.join(str(part) for part in error.absolute_path)
            errors.append(f'{source}{pointer}: {error.message}')
        if errors:
            raise ValidationError(errors)

    def validate_project(self, project):
        errors, targets = [], {}
        duration = project.duration
        def check_color(value,location):
            if value.startswith('$colors.'):
                key=value.split('.',1)[1]
                if key not in project.branding.get('colors',{}):
                    errors.append(f'{location}: unknown branding colour {value}')
                    return
                value=project.branding['colors'][key]
            try:
                ImageColor.getcolor(value,'RGBA')
            except (ValueError,TypeError):
                errors.append(f'{location}: invalid colour {value}')
        check_color(project.document['canvas'].get('background','#000000'),'project.json/canvas/background')
        if abs(duration*project.fps-round(duration*project.fps)) > 1e-6:
            errors.append('project.json/timeline/duration: duration × fps must be a whole number of frames')
        for asset_id, asset in project.assets.items():
            if asset['source'].startswith('system:') and (asset['type']!='font' or asset['source'] not in ('system:sans','system:sans-bold')):
                errors.append(f'assets.json/{asset_id}/source: supported system font aliases are system:sans and system:sans-bold')
            if not asset['source'].startswith('system:') and not project_path(project.root, asset['source']).is_file():
                errors.append(f'assets.json/{asset_id}/source: file not found: {asset["source"]}')
        scene_elements = {}
        for scene_id, scene in project.scenes.items():
            items = elements(scene)
            ids = [item['id'] for item in items]
            if len(ids) != len(set(ids)):
                errors.append(f'scene:{scene_id}/elements: element IDs must be unique, including group children')
            scene_elements[scene_id] = {item['id']: item for item in items}
            for item in items:
                location = f'scene:{scene_id}/element:{item["id"]}'
                kind = item['type']
                if kind not in RENDERERS.handlers:
                    errors.append(f'{location}/type: unknown renderer {kind}')
                for effect in item.get('effects',[]):
                    if effect['type'] not in EFFECTS.handlers and effect['type']!='trail':
                        errors.append(f'{location}/effects: unknown effect {effect["type"]}')
                if kind in ('image', 'video') or kind=='path' and item.get('asset'):
                    asset = project.assets.get(item.get('asset'))
                    if not asset or asset['type'] != kind:
                        errors.append(f'{location}/asset: expected a registered {kind} asset')
                if kind == 'shape' and not item.get('shape'):
                    errors.append(f'{location}/shape: required for shape elements')
                if kind == 'group' and not item.get('children'):
                    errors.append(f'{location}/children: group must contain elements')
                if kind == 'path' and not any(key in item for key in ('asset', 'path', 'points', 'segments')):
                    errors.append(f'{location}: path elements require asset, path, points or segments')
                if item.get('style') and item['style'] not in project.branding.get('textStyles', {}):
                    errors.append(f'{location}/style: unknown branding style {item["style"]}')
                style = project.branding.get('textStyles', {}).get(item.get('style'), {})
                for field in ('color','fill','stroke'):
                    if field in item or field in style:
                        check_color(item.get(field,style.get(field)),f'{location}/{field}')
                for effect in item.get('effects',[]):
                    if 'color' in effect:
                        check_color(effect['color'],f'{location}/effects/color')
                font_id = item.get('font', style.get('font'))
                if font_id and (font_id not in project.assets or project.assets[font_id]['type'] != 'font'):
                    errors.append(f'{location}/font: unknown font asset {font_id}')
                if item.get('visibility', {}).get('end', duration) < item.get('visibility', {}).get('start', 0):
                    errors.append(f'{location}/visibility: end must not precede start')
        clip_ids, path_ids, track_ids = set(), set(), set()
        for clip in project.timeline['clips']:
            if clip['id'] in clip_ids:
                errors.append(f'timeline.json/clips: duplicate clip ID {clip["id"]}')
            clip_ids.add(clip['id'])
            if clip['scene'] not in project.scenes:
                errors.append(f'timeline.json/clips/{clip["id"]}/scene: unknown scene {clip["scene"]}')
                continue
            if clip['start']+clip['duration'] > duration+1e-6:
                errors.append(f'timeline.json/clips/{clip["id"]}: clip extends beyond project duration')
            for element_id, element in scene_elements[clip['scene']].items():
                targets[f'{clip["id"]}/{element_id}'] = element
        paths = {}
        for path in project.timeline.get('paths', []):
            if path['id'] in path_ids:
                errors.append(f'timeline.json/paths: duplicate path ID {path["id"]}')
            path_ids.add(path['id']); paths[path['id']] = path
            if path.get('type') == 'bezier' and (len(path['points'])-1) % 3:
                errors.append(f'timeline.json/paths/{path["id"]}: cubic Bezier needs 4, 7, 10... control points')
            elif sum(math.dist(a,b) for a,b in zip(path_points(path),path_points(path)[1:])) == 0:
                errors.append(f'timeline.json/paths/{path["id"]}: path has zero length')
        for target, element in targets.items():
            if element.get('path') and element['path'] not in paths:
                errors.append(f'{target}/path: unknown path {element["path"]}')
        tracks = project.timeline.get('tracks', [])
        valid_tracks = []
        for track in tracks:
            location = f'timeline.json/tracks/{track["id"]}'
            if track['id'] in track_ids:
                errors.append(f'{location}: duplicate track ID')
            track_ids.add(track['id'])
            if track['target'] not in targets:
                errors.append(f'{location}/target: unknown target {track["target"]}')
            if 'keyframes' in track:
                times = [frame['time'] for frame in track['keyframes']]
                if any(b <= a for a,b in zip(times,times[1:])):
                    errors.append(f'{location}/keyframes: times must be strictly increasing')
                property_name = track['property']
                for frame in track['keyframes']:
                    value = frame['value']
                    if property_name in ('position','scale') and not (isinstance(value,list) and len(value)==2 and all(isinstance(x,(int,float)) for x in value)):
                        errors.append(f'{location}/keyframes: {property_name} requires two numbers')
                    elif property_name in ('opacity','rotation','strokeWidth','reveal','textReveal') and not isinstance(value,(int,float)):
                        errors.append(f'{location}/keyframes: {property_name} requires a number')
            elif track['animation'] not in ANIMATIONS.handlers:
                errors.append(f'{location}/animation: unknown animation {track["animation"]}')
                continue
            elif track['animation'] == 'followPath':
                path_id = track.get('path',track.get('parameters',{}).get('path'))
                if path_id not in paths:
                    errors.append(f'{location}/parameters/path: unknown path {path_id}')
                if track.get('parameters',{}).get('speedMode','constant') != 'constant':
                    errors.append(f'{location}/parameters/speedMode: only constant arc-length traversal is supported')
            for prop in writes(track):
                if prop.startswith('effects.') and track['target'] in targets:
                    index = int(prop.split('.')[1])
                    if index >= len(targets[track['target']].get('effects',[])):
                        errors.append(f'{location}/property: effect index {index} does not exist')
            start, end = interval(track)
            if end > duration+1e-6 and track['target'].split('/')[0] not in project.compositions:
                errors.append(f'{location}: track extends beyond project duration')
            valid_tracks.append(track)
        for index, first in enumerate(valid_tracks):
            for second in valid_tracks[index+1:]:
                if first['target'] != second['target'] or not (writes(first) & writes(second)):
                    continue
                a,b = interval(first); c,d = interval(second)
                if max(a,c) < min(b,d):
                    errors.append(f'timeline.json/tracks: conflicting writes by {first["id"]} and {second["id"]}')
        for track in project.timeline.get('audio',[]):
            asset = project.assets.get(track['asset'])
            if not asset or asset['type'] not in ('audio','video'):
                errors.append(f'timeline.json/audio/{track["id"]}/asset: expected an audio or video asset')
            if track['start']+track['duration'] > duration+1e-6:
                errors.append(f'timeline.json/audio/{track["id"]}: clip extends beyond project duration')
        resolution = project.export.get('resolution',dict(zip(('width','height'),project.canvas_size)))
        if any(resolution[key] % 2 for key in ('width','height')):
            errors.append('export.json/resolution: H.264 yuv420p requires even width and height')
        if errors:
            raise ValidationError(errors)
