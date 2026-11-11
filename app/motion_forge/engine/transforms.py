import math
import numpy as np
from PIL import Image

def place(image, canvas_size, transform, original_size, offset=(0,0)):
    """Transform a local RGBA surface; keep its anchor stable when effects add padding."""
    x,y=transform.get('position',[0,0]); ax,ay=transform.get('anchor',[0,0])
    sx,sy=transform.get('scale',[1,1]); angle=math.radians(transform.get('rotation',0))
    output=Image.new('RGBA',canvas_size)
    if abs(sx)<1e-9 or abs(sy)<1e-9:
        return output
    c,s=math.cos(angle),math.sin(angle)
    dx,dy=offset[0]-ax*original_size[0],offset[1]-ay*original_size[1]
    matrix=np.array([[c*sx,-s*sy,x+c*sx*dx-s*sy*dy],[s*sx,c*sy,y+s*sx*dx+c*sy*dy],[0,0,1]])
    corners=np.array([[0,image.width,image.width,0],[0,0,image.height,image.height],[1,1,1,1]])
    mapped=matrix@corners
    left,top=max(0,math.floor(mapped[0].min())),max(0,math.floor(mapped[1].min()))
    right,bottom=min(canvas_size[0],math.ceil(mapped[0].max())),min(canvas_size[1],math.ceil(mapped[1].max()))
    if right<=left or bottom<=top:
        return output
    inverse=np.linalg.inv(matrix)
    coefficients=(inverse[0,0],inverse[0,1],inverse[0,2]+inverse[0,0]*left+inverse[0,1]*top,
                  inverse[1,0],inverse[1,1],inverse[1,2]+inverse[1,0]*left+inverse[1,1]*top)
    tile=image.transform((right-left,bottom-top),Image.Transform.AFFINE,coefficients,Image.Resampling.BICUBIC)
    opacity=max(0,min(1,transform.get('opacity',1)))
    if opacity < 1:
        tile.putalpha(tile.getchannel('A').point(lambda a:round(a*opacity)))
    output.alpha_composite(tile,(left,top))
    return output
