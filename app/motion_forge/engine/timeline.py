from .easing import ease
from .interpolation import interpolate
from ..animations.presets import ANIMATIONS, writes

def interval(track):
    if 'keyframes' in track:
        return track['keyframes'][0]['time'], track['keyframes'][-1]['time']
    return track['start'], track['start'] + track['duration']*(track.get('repeat', 0)+1)

def track_values(track, time, paths):
    start, end = interval(track)
    before, after = track.get('before', 'holdFirst'), track.get('after', 'holdLast')
    if time < start and before == 'base' or time > end and after == 'base':
        return {}
    if 'keyframes' in track:
        frames = track['keyframes']
        value = frames[0]['value']
        for first, second in zip(frames, frames[1:]):
            if time >= second['time']:
                value = second['value']
            elif time >= first['time']:
                fraction = (time-first['time'])/(second['time']-first['time'])
                value = interpolate(first['value'], second['value'], ease(second.get('easing', 'linear'), fraction))
                break
        return {track['property']: value}
    if time <= start:
        progress = 0.0
    elif time >= end:
        progress = 1.0
    else:
        progress = ((time-start) % track['duration']) / track['duration']
    return ANIMATIONS.get(track['animation'])(track, ease(track.get('easing', 'linear'), progress), paths)

class Timeline:
    def __init__(self, document):
        self.paths = {path['id']: path for path in document.get('paths', [])}
        self.tracks = {}
        for track in document.get('tracks', []):
            self.tracks.setdefault(track['target'], []).append(track)

    def values(self, target, time):
        # Held values from an earlier track yield to the next scheduled track.
        active = {}
        for track in sorted(self.tracks.get(target, []), key=lambda item: interval(item)[0]):
            for property_name, value in track_values(track, time, self.paths).items():
                start = interval(track)[0]
                priority = (start <= time, start if start <= time else -start)
                if property_name not in active or priority > active[property_name][0]:
                    active[property_name] = (priority, value)
        return {name: value[1] for name, value in active.items()}
