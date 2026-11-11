import math
from PIL import Image, ImageFilter, ImageColor
from .registry import EFFECTS

def halo(image,effect,shadow=False):
    radius=effect.get('radius',16)
    dx,dy=effect.get('offset',[6,6]) if shadow else [0,0]
    padding=math.ceil(radius*3+max(abs(dx),abs(dy))+2)
    output=Image.new('RGBA',(image.width+padding*2,image.height+padding*2))
    mask=Image.new('L',output.size)
    mask.paste(image.getchannel('A'),(padding+round(dx),padding+round(dy)))
    mask=mask.filter(ImageFilter.GaussianBlur(radius))
    intensity=effect.get('intensity',0.8)
    # Normalize glow bloom so small light points remain visibly luminous.
    peak=mask.getextrema()[1]
    gain=(255/max(1,peak)) if not shadow else 1
    mask=mask.point(lambda alpha:min(255,round(alpha*intensity*gain)))
    glow=Image.new('RGBA',output.size,ImageColor.getcolor(effect.get('color','#000000' if shadow else '#42E1E6'),'RGBA'))
    color_alpha=glow.getpixel((0,0))[3]/255
    glow.putalpha(mask.point(lambda alpha:round(alpha*color_alpha)))
    output.alpha_composite(glow)
    output.alpha_composite(image,(padding,padding))
    return output,(-padding,-padding)

EFFECTS.register('glow',lambda image,effect:halo(image,effect))
EFFECTS.register('shadow',lambda image,effect:halo(image,effect,True))
EFFECTS.register('blur',lambda image,effect:(image.filter(ImageFilter.GaussianBlur(effect.get('radius',4))),(0,0)))
