import os
from pathlib import Path
from ..utils.errors import MotionForgeError

def resolve_system_font(name='sans'):
    bold = name.endswith('bold')
    windows = Path(os.environ.get('WINDIR', 'C:/Windows')) / 'Fonts'
    candidates = [windows / ('arialbd.ttf' if bold else 'arial.ttf'),
                  Path('/usr/share/fonts/truetype/dejavu') / ('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'),
                  Path('/System/Library/Fonts/Supplemental') / ('Arial Bold.ttf' if bold else 'Arial.ttf')]
    for path in candidates:
        if path.is_file():
            return str(path)
    raise MotionForgeError('No system sans-serif font found. Register a font file in assets.json and reference its ID in the text style.')
