from PIL import ImageColor

def interpolate(a, b, fraction):
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return a + (b-a)*fraction
    if isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        return [interpolate(x, y, fraction) for x, y in zip(a, b)]
    if isinstance(a, str) and isinstance(b, str) and a.startswith('#') and b.startswith('#'):
        first, second = ImageColor.getcolor(a, 'RGBA'), ImageColor.getcolor(b, 'RGBA')
        return '#' + ''.join(f'{round(x+(y-x)*fraction):02x}' for x, y in zip(first, second))
    return b if fraction >= 1 else a
