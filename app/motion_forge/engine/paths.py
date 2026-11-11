import math
from ..utils.errors import MotionForgeError

def path_points(path):
    points = path['points']
    if path.get('type', 'polyline') == 'polyline':
        return points
    # Cubic Bezier control points: P0, P1, P2, P3, then P4/P5/P6 etc.
    result = []
    for start in range(0, len(points)-1, 3):
        p0, p1, p2, p3 = points[start:start+4]
        for index in range(129):
            t = index/128
            result.append([(1-t)**3*p0[d] + 3*(1-t)**2*t*p1[d] +
                           3*(1-t)*t*t*p2[d] + t**3*p3[d] for d in (0, 1)])
    return result

def path_sample(path, progress):
    """Arc-length evaluation keeps movement continuous through segment boundaries."""
    points = path_points(path)
    lengths = [math.dist(a, b) for a, b in zip(points, points[1:])]
    total = sum(lengths)
    if total <= 0:
        raise MotionForgeError('A path must have a nonzero length.')
    remaining = max(0, min(1, progress))*total
    for a, b, length in zip(points, points[1:], lengths):
        if length and remaining <= length:
            fraction = remaining/length
            return [a[0]+(b[0]-a[0])*fraction, a[1]+(b[1]-a[1])*fraction], math.degrees(math.atan2(b[1]-a[1], b[0]-a[0]))
        remaining -= length
    a, b = points[-2:]
    return list(b), math.degrees(math.atan2(b[1]-a[1], b[0]-a[0]))

def partial_path(path, progress):
    points = path_points(path)
    lengths = [math.dist(a, b) for a, b in zip(points, points[1:])]
    remaining = max(0, min(1, progress))*sum(lengths)
    result = [points[0]]
    for a, b, length in zip(points, points[1:], lengths):
        if length and remaining < length:
            result.append([a[d]+(b[d]-a[d])*remaining/length for d in (0, 1)])
            break
        result.append(b)
        remaining -= length
    return result
