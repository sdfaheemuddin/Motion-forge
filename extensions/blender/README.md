# Optional Blender asset generation

The generic renderer consumes transparent PNG assets and does not require Blender. The example generator is in energy_scene.py; run it inside Blender with `blender -b -P extensions/blender/energy_scene.py`. It writes to the PVInsight example asset directory and must be followed by prepare_assets.py.
