# Motion Forge

A modular, JSON-driven video maker. Define assets, scenes, branding and animation tracks, then validate, preview or export through the CLI, Python API or local HTTP API.

## Windows quick start

1. Install Python 3.11 or newer and extract/clone this repository.
2. Double-click `setup.bat`. It creates `.venv`, installs the package and API dependencies, and checks fonts and FFmpeg.
3. Double-click `render.bat` for the four-second generic example.

For the PVInsight example, open Terminal in the repository directory:

```powershell
render.bat projects\pvinsight-blueprint\project.json
```

The examples write to `output/quick-start/` and `output/pvinsight-blueprint/`. The repository includes all required example PNGs. Blender is optional and is used only to regenerate the 3D assets.

FFmpeg is resolved from `MOTION_FORGE_FFMPEG`, your PATH, or the platform binary supplied by `imageio-ffmpeg`. Normal installation does not require manual FFmpeg PATH edits. System fonts are resolved on Windows, Linux and macOS; you can instead register a font file for consistent typography across computers.

## Manual installation and CLI

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
python -m pip install -e ".[api,dev]"
motion-forge doctor
motion-forge validate projects/quick-start/project.json
motion-forge preview projects/quick-start/project.json --time 2
motion-forge render projects/quick-start/project.json
motion-forge render projects/pvinsight-blueprint/project.json
```

Every CLI command also works as `python -m motion_forge ...`. Failed validation exits with status 1 and identifies the offending file/field. An unsuccessful export preserves an existing completed video.

## JSON files

| File | Responsibility |
| --- | --- |
| `project.json` | Schema version, canvas, duration/FPS and configuration references |
| `assets.json` | Image, path, font, audio and video IDs and paths |
| `branding.json` | Palette, logo ID and reusable text styles |
| `scenes/*.json` | Elements, groups, layers, layout, visibility and effects |
| `timeline.json` | Scene clips, shared paths, keyframes, animation tracks and audio |
| `export.json` | Filename, directory, resolution, H.264 quality, audio and loop check |

All configuration and asset paths resolve relative to the entry `project.json`. There are no PVInsight-specific branches in the engine. Start another video by copying `templates/basic-motion/` and editing its JSON files.

## Supported in 0.1

- Image, text, shape, path, group and video elements.
- Position, scale, clockwise rotation, opacity, fill/stroke, stroke width, reveal, text reveal and effect-property tracks.
- `fadeIn`, `fadeOut`, `slideIn`, `zoomIn`, `pulse`, `followPath`, `wipeReveal` and `typewriter` presets.
- Glow, shadow, blur and time-sampled trails; polyline and cubic Bezier paths.
- One project clock, constant arc-length traversal, deterministic preview seeking, explicit repeats and conflict detection.
- Multiple audio tracks with trim, volume, fade-in/out and delayed starts. Video elements are silent; schedule their audio explicitly.
- PNG previews, H.264 MP4 exports, FFmpeg error logs and JSON render manifests. Optional loop endpoint comparison reports a warning rather than modifying the animation.
- A local API with one render worker, persisted job status and progress.
- Installed Python plugin registries for animations, effects and element renderers.

This version is a JSON authoring tool. It has no visual timeline editor. Built-in easing is linear/ease-in/ease-out/ease-in-out; video playback speed must be positive. Keyframe timing is project-global. Bezier length is approximated by sampled segments. The Blender helper remains a project-specific optional generator, separate from the core.

## Python API

```python
from motion_forge import load_project, preview_project, render_project

project = load_project("projects/quick-start/project.json")
preview_project("projects/quick-start/project.json", time=2)
render_project("projects/quick-start/project.json")
```

## HTTP API

```bash
motion-forge serve --root . --host 127.0.0.1 --port 8765
```

Open `http://127.0.0.1:8765/docs` for the interactive API. Submit `{"project":"projects/quick-start/project.json"}` to `POST /validate` or `POST /renders`; poll `GET /jobs/{id}` and download `GET /jobs/{id}/video`. Project and asset references are confined to the configured API root. Jobs interrupted by a server restart become failed and can be resubmitted.

## Development

```bash
python -m unittest discover -s tests -v
```

CI runs the suite on Windows and Linux with Python 3.11 and 3.12. See [architecture](docs/architecture.md), [JSON reference](docs/json-reference.md), [animations and effects](docs/animations-and-effects.md), [plugins](docs/creating-plugins.md), and [API reference](docs/api-reference.md).
