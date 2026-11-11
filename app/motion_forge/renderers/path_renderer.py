"""Path and blueprint linework renderer."""
from PIL import Image, ImageDraw
from ..engine.paths import partial_path

def render(renderer,state,clip,time):
    image = Image.new('RGBA', state.get('_canvas_size',renderer.size))
    draw = ImageDraw.Draw(image)
    if state.get('asset'):
        data=renderer.assets.path(state['asset'])
        segments=data.get('segments') or [partial_path(data,state.get('progress',1))]
    elif state.get('path'):
        segments = [partial_path(renderer.timeline.paths[state['path']], state.get('progress', 1))]
    elif state.get('points'):
        segments = [partial_path({'points': state['points']}, state.get('progress', 1))]
    else:
        segments = state.get('segments', [])
    for points in segments:
        draw.line([tuple(point) for point in points], fill=renderer.color(state.get('stroke', '#FFFFFF')), width=max(1, round(state.get('strokeWidth', 2))), joint='curve')
    return image
