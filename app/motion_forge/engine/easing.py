EASINGS = {
    'linear': lambda t: t,
    'easeIn': lambda t: t*t,
    'easeOut': lambda t: 1-(1-t)*(1-t),
    'easeInOut': lambda t: t*t*(3-2*t),
}

def ease(name, value):
    return EASINGS[name](max(0.0, min(1.0, value)))
