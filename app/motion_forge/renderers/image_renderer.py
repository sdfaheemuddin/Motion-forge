"""Image element renderer."""
from PIL import Image, ImageOps

def render(renderer,state,clip,time):
    kind=state['type']
    if kind == 'image':
        image = renderer.assets.image(state['asset'])
    else:
        origin = max(clip['start'], state.get('visibility', {}).get('start', clip['start']))
        source_time = state.get('trimStart', 0) + (time - origin) * state.get('playbackSpeed', 1)
        image = renderer.assets.video(state['asset'], source_time)
    width = state.get('width')
    height = state.get('height')
    if width is None and height is None:
        return image
    width = round(width if width is not None else image.width * height / image.height)
    height = round(height if height is not None else image.height * width / image.width)
    target = (max(1, width), max(1, height))
    fit = state.get('fit', 'contain')
    if fit == 'stretch':
        return image.resize(target, Image.Resampling.LANCZOS)
    if fit == 'cover':
        return ImageOps.fit(image, target, Image.Resampling.LANCZOS)
    image = ImageOps.contain(image, target, Image.Resampling.LANCZOS)
    box = Image.new('RGBA', target)
    box.alpha_composite(image, ((target[0] - image.width) // 2, (target[1] - image.height) // 2))
    return box
