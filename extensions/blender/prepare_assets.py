"""Crop isolated transparent vertical PNGs and record scene placement in JSON."""
import json
import logging
from pathlib import Path

from PIL import Image

CONFIG = {
    'asset_directory': Path(__file__).resolve().parents[2] / 'projects' / 'pvinsight-blueprint' / 'assets' / 'verticals',
    'canvas_size': (1600, 900),
    'transparent_padding': 24,
    'vertical_files': {
        'site': 'Site.png',
        'solar': 'PV.png',
        'bess': 'BESS.png',
        'substation': 'Substation.png',
        'transmission': 'TLine.png',
        'datacenter': 'DataCenter.png',
    },
}
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def prepare_assets():
    """Keep cutouts convenient to reuse, without losing camera registration."""
    directory=CONFIG['asset_directory']
    manifest_path=directory/'placements.json'
    if manifest_path.is_file():
        manifest=json.loads(manifest_path.read_text())
        for entry in manifest['assets'].values():
            with Image.open(directory/entry['file']) as image:
                if list(image.size)!=entry['size']:
                    raise ValueError(f"Asset dimensions changed: {entry['file']}. Rebuild the assets before preparing them.")
        logging.info('Assets are already prepared; existing placements retained.')
        return manifest
    images={}
    # Validate the entire batch before changing any source image.
    for vertical,filename in CONFIG['vertical_files'].items():
        path=directory/filename
        if not path.is_file():
            raise FileNotFoundError(f'Missing vertical render: {path}. Run build_scene.py in Blender first.')
        image=Image.open(path).convert('RGBA')
        if image.size!=CONFIG['canvas_size']:
            raise ValueError(f'Expected a full-canvas render for {filename}; got {image.size}. Rebuild the assets first.')
        bounds=image.getchannel('A').getbbox()
        if bounds is None:
            raise ValueError(f'Vertical render is empty: {filename}. Check visibility of its Blender objects.')
        images[vertical]=(filename,image,bounds)
    manifest={'canvas_size':list(CONFIG['canvas_size']),'assets':{}}
    for vertical,(filename,image,bounds) in images.items():
        padding=CONFIG['transparent_padding']
        left=max(0,bounds[0]-padding)
        top=max(0,bounds[1]-padding)
        right=min(image.width,bounds[2]+padding)
        bottom=min(image.height,bounds[3]+padding)
        cropped=image.crop((left,top,right,bottom))
        cropped.save(directory/filename)
        manifest['assets'][vertical]={'file':filename,'position':[left,top],'size':list(cropped.size),'transparent':True}
        logging.info('Prepared %s: %s',filename,cropped.size)
    manifest_path.write_text(json.dumps(manifest,indent=2))
    return manifest

if __name__=='__main__':
    try:
        prepare_assets()
    except Exception:
        logging.exception('Could not prepare the isolated vertical assets')
        raise
