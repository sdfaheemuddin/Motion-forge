# Single-user video builder

The application runs locally with React/TypeScript and FastAPI. No accounts or database are required. Project JSON remains the source of truth, and the existing engine handles validation, accurate PNG frames, and MP4 exports.

## Structure

| Location | Responsibility |
| --- | --- |
| `ui/src/models/` | Typed project and timeline contracts |
| `ui/src/viewmodels/` | Shared draft, undo/redo, animation sampling, scene operations |
| `ui/src/views/` | Seven tab views |
| `ui/src/components/` | Canvas, transport, property editor, fields, JSON drawer |
| `ui/src/services/api.ts` | HTTP boundary |
| `app/motion_forge/controllers/builder_api.py` | Editor HTTP routes |
| `app/motion_forge/services/builder_service.py` | Create/copy, stage, validate, save, import |
| `app/motion_forge/web/dist/` | Committed production UI; included in Python packages |

Views update a shared working draft through the ViewModel. Rendering and file operations stay outside the UI. A draft contains `project.json` plus every referenced configuration document. Asset metadata is separate from editable JSON.

## API

Open `/docs` for request schemas and interactive examples.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/builder/projects` | Local project list |
| GET | `/builder/templates` | Reusable templates |
| POST | `/builder/projects` | Create blank project or copy template |
| GET | `/builder/project?project=...` | Read documents, revision, asset metadata |
| PUT | `/builder/project` | Validate and save `{project, documents, revision}` |
| POST | `/builder/validate` | Validate an unsaved draft |
| POST | `/builder/preview` | Render draft at `time` as PNG |
| POST | `/builder/assets?project=...&filename=...` | Import raw file bytes, max 100 MB |
| GET | `/builder/asset?project=...&source=...` | Serve project media |
| GET | `/builder/jobs` | Persisted render history |
| POST | `/renders` | Queue a saved project |
| GET | `/jobs/{id}` | Render status/progress |
| GET | `/jobs/{id}/video` | View/download completed MP4 |

Paths are confined to the configured workspace. Configuration writes are limited to `projects/`; templates are read-only. Saves compare revisions, stage and validate all JSON, back up prior documents, replace each file atomically, and roll back ordinary write failures. A process or power failure during a multi-file save may require restoring the backup; this is not a database transaction. Imports use immutable content-derived filenames. Origin checks reject browser writes from unrelated websites. Bind the normal single-user application to localhost.

## Editing behavior

All tracks and visibility intervals use the project clock. A follow-path track travels continuously across caption changes and holds its endpoint unless explicit repeats are configured. Moving a clip does not automatically retime its element animations. The Timeline tab exposes timing fields and draggable animation bars. Cubic Bezier routes need 4, 7, 10, ... control points.

The interactive canvas provides an approximate visual preview. Engine frames and exports are authoritative. Property overrides take precedence over reusable branding styles. Duplicating an element copies its properties and nested children, with fresh IDs; animation tracks are not copied. Delete removes the element and its animation targets within the affected scene.

The local worker processes one export at a time. Progress and manifests persist in `output/jobs/`. Interrupted jobs are marked failed after a server restart; resubmit them. There is no render cancellation or collaborative editing in this version.
