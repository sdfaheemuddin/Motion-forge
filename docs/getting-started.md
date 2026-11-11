# Getting started

On Windows run `setup.bat`, then `render.bat`. Supply a project entry path to render another project: `render.bat projects\pvinsight-blueprint\project.json`.

For a manual install use a Python 3.11+ virtual environment and `python -m pip install -e ".[api,dev]"`. `motion-forge doctor` reports the selected FFmpeg executable and platform font.

Copy `templates/basic-motion` to `projects/my-video`, then edit the six JSON configuration types. Run `motion-forge validate projects/my-video/project.json`, inspect PNG previews at key times, then render. The copied export directory/filename can be changed in `export.json`.

To reproduce typography exactly, use an appropriately licensed font file in your project and register it as an asset. `system:sans` and `system:sans-bold` select Arial on Windows/macOS or DejaVu Sans on Linux and can have different text metrics.

The optional Blender generator runs with `blender -b -P extensions/blender/energy_scene.py`; follow it with `python extensions/blender/prepare_assets.py`. Cropped PNG positions are recorded in placements.json. When changing the generated layout or bounds, update image positions and path geometry in the example scene/timeline JSON accordingly.

If a dependency or input is missing, read the named path in the error. `MOTION_FORGE_FFMPEG` can explicitly point to an FFmpeg executable. Environment variables must be set in the shell; `.env.example` documents them and is not automatically loaded.
