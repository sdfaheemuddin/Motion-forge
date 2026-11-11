"""Group element renderer."""
from PIL import Image

def render(renderer,state,clip,time):
    canvas=state.get('_canvas_size',renderer.size)
    image = Image.new('RGBA', (round(state.get('width', canvas[0])), round(state.get('height', canvas[1]))))
    for child in sorted(state['children'], key=lambda item: item.get('layer', 0)):
        layer = renderer.element(child, clip, time, canvas_size=image.size)
        image.alpha_composite(layer)
    return image
