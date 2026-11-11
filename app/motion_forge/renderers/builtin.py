from .registry import RENDERERS
from . import image_renderer, text_renderer, shape_renderer, path_renderer, group_renderer

for name,handler in [('image',image_renderer.render),('video',image_renderer.render),
                     ('text',text_renderer.render),('shape',shape_renderer.render),
                     ('path',path_renderer.render),('group',group_renderer.render)]:
    RENDERERS.register(name,handler)
