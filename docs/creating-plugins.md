# Installed plugins

Register a trusted Python package under the `motion_forge.plugins` entry-point group. Its entry-point function accepts keyword arguments `animations`, `effects` and `renderers`. Plugin code is loaded once per process. Project JSON cannot name/import arbitrary Python modules.

An animation handler receives `(track, progress, paths)` and returns a property/value dictionary. Register with `animations.register("myAnimation", handler, properties=["opacity"])`; declare written properties so overlap validation remains correct. Built-in followPath has special handling for its conditional rotation write.

An effect handler receives `(rgba_image, effect_config)` and returns `(rgba_image, [offset_x, offset_y])`. The offset records additional padding relative to the original element origin. Register through `effects.register(name, handler)`.

An element renderer receives `(frame_renderer, element_state, clip, time)` and returns a local RGBA image. Register through `renderers.register(name, handler)`. Custom renderer configuration can use the element's parameters object. Plugins must validate their own parameter contracts; the core validates shared fields and registered handler names. Registries reject duplicate names.

Blender helpers are optional asset-generation utilities rather than frame-renderer dependencies. Keep project-specific generation presets in the extension directory and feed their exported files to ordinary asset IDs.
