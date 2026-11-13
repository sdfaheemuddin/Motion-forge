# Single-user video builder

The application runs locally with React/TypeScript and FastAPI. No accounts or database are required. Project JSON remains the source of truth, and the existing engine handles validation, accurate PNG frames, and MP4 exports.

## Structure

| Location | Responsibility |
| --- | --- |
| `ui/src/models/` | Typed project and timeline contracts |
| `ui/src/viewmodels/` | Shared draft, undo/redo, animation sampling, scene operations |
| `ui/src/views/` | Eight tab views |
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


## Layout Design and Scenes (0.3)

Layout Design edits reusable layouts and shared compositions using the document selector on the left. A layout places fixed graphics, logo, text slots, navigation and a rectangular content viewport. Give a text/image/video element a **Scene content key** to bind it to scene values. Repeated keys intentionally share the same value. `logo` defaults to the branding logo. Layout text is the default when a scene has no override.

Scenes edits instances. Each scene references a layout and composition by ID, provides `values`, selects `activeNavigationItem` (`""` none, an item ID, or `"*"` all), and defines `camera.focus`, `transition`, `fit` and `easing`. The scene strip selects clips; dragging a right edge changes duration and shifts subsequent scene clips. Earlier/Later reorders the sequence, Duplicate creates an independent scene instance, and Remove deletes an instance while retaining reusable layouts/content.

Draw a focus rectangle in the source view, drag inside it to move, or drag its bottom-right corner to resize. Numeric fields use composition pixels. Fit includes the whole rectangle with letterboxing; Fill crops centrally to fill the layout viewport. Neither stretches the source. Camera transitions interpolate from the previous scene's focus when it uses the same composition. The duration cannot exceed the scene clip. Disconnected compositions start at their own focus. Layered/overlapping clips still render in layer order; the scene sequence controls are intended for a linear storyboard.

Composition animation targets use `<composition-id>/<element-id>` and sample project time. Scene changes never restart the energy point. Layout overlay animations use `<scene-clip-id>/<layout-element-id>` and also sample project time. Scene duration/order edits leave these animation keyframes and audio times unchanged. Composition tracks can extend beyond the output duration, so shortening a storyboard does not retime shared movement; export ends at the project duration. Use Timeline to explicitly change the animation/audio timing.

The render service resolves layout bindings and navigation, renders shared content, crops the camera view into the viewport, then composites fixed overlays. The canvas uses the same camera math for fast previews. Engine frames and MP4 export remain authoritative.

Legacy JSON scenes with `elements` still work without migration. New blank projects use the separated format. The PVI example and reusable PVI project template have been migrated to layouts/compositions/seven scenes. Their earlier versions remain in Git history.
