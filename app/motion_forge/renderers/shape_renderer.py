"""Shape element renderer."""
from PIL import Image, ImageDraw

def render(renderer,state,clip,time):
    radius = state.get('radius', 20)
    size = (max(1, round(state.get('width', radius * 2))), max(1, round(state.get('height', radius * 2))))
    image = Image.new('RGBA', size)
    draw = ImageDraw.Draw(image)
    bounds = (0, 0, size[0] - 1, size[1] - 1)
    kwargs = {'fill': renderer.color(state.get('fill', '#FFFFFF')), 'outline': renderer.color(state['stroke']) if state.get('stroke') else None, 'width': round(state.get('strokeWidth', 1))}
    if state['shape'] in ('circle', 'ellipse'):
        draw.ellipse(bounds, **kwargs)
    else:
        draw.rounded_rectangle(bounds, radius=state.get('cornerRadius', 0), **kwargs)
    return image
