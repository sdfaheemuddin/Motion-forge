# Architecture

The application package lives in `app/motion_forge`. `pyproject.toml` declares its dependencies and CLI entry point.

| Component | Responsibility |
| --- | --- |
| controllers | CLI and optional HTTP requests |
| models | Validated project aggregate, independent of either interface |
| repositories | JSON project loading, cached asset access and job persistence |
| services | Semantic validation, preview/render orchestration and queued jobs |
| engine | Global clock, interpolation, easing, transforms and arc-length paths |
| animations | Named preset implementations and registration |
| effects | Reusable RGBA appearance processing |
| renderers | Separate image/video, text, shape, path, group and frame renderers |
| infrastructure | FFmpeg encoding, audio mixing, video decoding and platform font resolution |
| plugins | Installed extension discovery and contracts |

Controllers call services. A frame renderer evaluates the project at a timestamp, resolves each element's state, draws it through its renderer, applies effects and transforms, and composites it in layer order. Export orchestration streams frames to FFmpeg without keeping the entire film in memory.

Frame evaluation is independent of render order. The video decoder optimizes forward reads and restarts for backward seeks. Trail samples explicitly evaluate earlier timestamps; they do not use mutable state left by earlier frames.

Only project JSON and assets contain business-specific content. The generic quick-start project and the PVInsight project use the same engine. Optional Blender scripts under `extensions/blender` generate assets and are never required for normal rendering.

JSON schemas and defaults are installed under `share/motion-forge` in a wheel, so an installed CLI does not depend on a source checkout. Output, runtime job status, caches, environment files and build artifacts are excluded from Git.
