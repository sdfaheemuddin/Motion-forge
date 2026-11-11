"""Text element renderer."""
from PIL import Image, ImageDraw

def render(renderer,state,clip,time):
    font = renderer.assets.font(state.get('font'), state['size'])
    text = state.get('text', '')
    text = text[:round(len(text) * max(0, min(1, state.get('textReveal', 1))))]
    spacing = round(state['size'] * (state.get('lineSpacing', 1.2) - 1))
    draw = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
    if state.get('width'):
        lines = []
        for paragraph in text.split('\n'):
            line = ''
            for word in paragraph.split(' '):
                proposed = (line + ' ' + word).strip()
                if line and draw.textlength(proposed, font=font) > state['width']:
                    lines.append(line)
                    line = word
                else:
                    line = proposed
            lines.append(line)
        text = '\n'.join(lines)
    bounds = draw.multiline_textbbox((0, 0), text or ' ', font=font, spacing=spacing, align=state.get('align', 'left'))
    width = round(state.get('width', max(1, bounds[2] - bounds[0] + 2)))
    height = round(state.get('height', max(1, bounds[3] - bounds[1] + 2)))
    image = Image.new('RGBA', (width, height))
    x = {'left': -bounds[0], 'center': (width - (bounds[2] - bounds[0])) / 2 - bounds[0], 'right': width - (bounds[2] - bounds[0]) - bounds[0]}[state.get('align', 'left')]
    ImageDraw.Draw(image).multiline_text((x, -bounds[1]), text, font=font, fill=renderer.color(state['color']), spacing=spacing, align=state.get('align', 'left'))
    return image
