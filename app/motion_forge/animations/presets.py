from .registry import Registry
from ..engine.interpolation import interpolate
from ..engine.paths import path_sample

ANIMATIONS = Registry()

def property_handler(property_name, start, end):
    def apply(track, progress, paths):
        parameters = track.get('parameters', {})
        return {property_name: interpolate(parameters.get('from', start), parameters.get('to', end), progress)}
    return apply

ANIMATIONS.register('fadeIn', property_handler('opacity', 0, 1))
ANIMATIONS.register('fadeOut', property_handler('opacity', 1, 0))
ANIMATIONS.register('slideIn', property_handler('position', [-200, 0], [0, 0]))
ANIMATIONS.register('zoomIn', property_handler('scale', [0.8, 0.8], [1, 1]))
ANIMATIONS.register('wipeReveal', property_handler('reveal', 0, 1))
ANIMATIONS.register('typewriter', property_handler('textReveal', 0, 1))

def pulse(track, progress, paths):
    import math
    parameters = track.get('parameters', {})
    fraction = (1-math.cos(progress*math.tau))/2
    return {parameters.get('property', 'opacity'): interpolate(parameters.get('from', 0.4), parameters.get('to', 1), fraction)}

def follow_path(track, progress, paths):
    parameters = track.get('parameters', {})
    path = paths[track.get('path', parameters.get('path'))]
    point, angle = path_sample(path, progress)
    result = {'position': point}
    if parameters.get('orientToPath', False):
        result['rotation'] = angle
    return result

ANIMATIONS.register('pulse', pulse)
ANIMATIONS.register('followPath', follow_path)

def writes(track):
    """Properties written by a track, including implicit preset writes."""
    if 'property' in track:
        return {track['property']}
    animation = track['animation']
    if animation == 'followPath':
        return {'position', 'rotation'} if track.get('parameters', {}).get('orientToPath') else {'position'}
    if animation == 'pulse':
        return {track.get('parameters', {}).get('property', 'opacity')}
    names={'fadeIn': 'opacity', 'fadeOut': 'opacity', 'slideIn': 'position', 'zoomIn': 'scale',
           'wipeReveal': 'reveal', 'typewriter': 'textReveal'}
    return {names[animation]} if animation in names else ANIMATIONS.properties.get(animation,set())
