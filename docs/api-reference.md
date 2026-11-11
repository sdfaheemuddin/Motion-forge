# Local HTTP API

Install with `python -m pip install -e ".[api]"`, then start `motion-forge serve --root .`. The default endpoint is http://127.0.0.1:8765 and OpenAPI documentation is at /docs. There is no authentication layer; this initial server is intended for local automation.

| Method | Route | Request / result |
| --- | --- | --- |
| GET | /health | status ok |
| POST | /validate | project path → validation result |
| POST | /preview | project path and time → PNG bytes |
| POST | /renders | project path → queued job, HTTP 202 |
| GET | /jobs/{id} | queued/running/completed/failed and progress 0–1 |
| GET | /jobs/{id}/video | completed MP4, otherwise HTTP 409 |

Project request: `{"project":"projects/quick-start/project.json"}`. Preview request adds `"time":2`. HTTP 400 contains actionable validation/render errors; an invalid or unknown job ID returns 404.

Project/configuration/asset references must remain within the configured server root. Render outputs use server-generated job directories under output/jobs, independent of the project's CLI output setting. Each service instance uses one worker and persists job.json. A server restart marks unfinished jobs failed; submit again to retry. Run a single API process for this filesystem queue.
