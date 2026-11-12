import type {
  Bundle,
  ProjectSummary,
  ValidationResult,
  Job,
  Asset,
  AssetMetadata,
} from "../models/types";

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function checked(response: Response) {
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      const detail = payload.detail ?? payload;
      message =
        typeof detail === "string"
          ? detail
          : (detail.errors?.join("\n") ?? JSON.stringify(detail));
    } catch {
      /* Keep the HTTP status when the server did not return JSON. */
    }
    throw new APIError(message, response.status);
  }
  return response;
}
async function json<T>(url: string, options?: RequestInit): Promise<T> {
  return (await checked(await fetch(url, options))).json();
}
function body(bundle: Bundle) {
  return {
    project: bundle.project,
    revision: bundle.revision,
    documents: bundle.documents,
  };
}
function post(value: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  };
}
export const api = {
  projects: () => json<{ projects: ProjectSummary[] }>("/builder/projects"),
  templates: () => json<{ templates: ProjectSummary[] }>("/builder/templates"),
  open: (project: string) =>
    json<Bundle>(`/builder/project?${new URLSearchParams({ project })}`),
  create: (name: string, template?: string) =>
    json<Bundle>(
      "/builder/projects",
      post({ name, template: template || null }),
    ),
  save: (bundle: Bundle) =>
    json<Bundle>("/builder/project", { ...post(body(bundle)), method: "PUT" }),
  validate: (bundle: Bundle) =>
    json<ValidationResult>("/builder/validate", post(body(bundle))),
  preview: async (bundle: Bundle, time: number) =>
    (
      await checked(
        await fetch("/builder/preview", post({ ...body(bundle), time })),
      )
    ).blob(),
  upload: (project: string, file: File) =>
    json<{ asset: Asset; metadata: AssetMetadata }>(
      `/builder/assets?${new URLSearchParams({ project, filename: file.name })}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
      },
    ),
  render: (project: string) => json<Job>("/renders", post({ project })),
  jobs: () => json<{ jobs: Job[] }>("/builder/jobs"),
  video: (id: string) => `/jobs/${encodeURIComponent(id)}/video`,
};
