import { useState } from "react";
import {
  Plus,
  ArrowUpRight,
  Film,
  Layers3,
  Clock3,
  Sparkles,
  FolderOpen,
  Copy,
} from "lucide-react";
import { useBuilder } from "../viewmodels/BuilderContext";
import {
  PageHeading,
  Modal,
  TextField,
  SelectField,
  NumberField,
  Section,
  Spinner,
} from "../components/Fields";
import { projectDoc } from "../viewmodels/projectModel";

export function ProjectsView() {
  const vm = useBuilder(),
    [modal, setModal] = useState(false),
    [name, setName] = useState(""),
    [template, setTemplate] = useState("");
  const newProject = (from = "") => {
    setName(from.includes("pvinsight") ? "PVI brand video" : "");
    setTemplate(from);
    setModal(true);
  };
  return (
    <div className="page-scroll">
      <PageHeading
        title="Your workspace"
        subtitle="Start with an idea. Shape it into a story."
      >
        <button className="button primary" onClick={() => newProject()}>
          <Plus size={17} />
          New project
        </button>
      </PageHeading>
      <div className="workspace-summary">
        <div>
          <span className="summary-icon">
            <Film size={21} />
          </span>
          <strong>
            {vm.projects.length}
            <small>Projects</small>
          </strong>
        </div>
        <div>
          <span className="summary-icon">
            <Layers3 size={21} />
          </span>
          <strong>
            {vm.templates.length}
            <small>Ready-to-use templates</small>
          </strong>
        </div>
        <div>
          <span className="summary-icon">
            <Clock3 size={21} />
          </span>
          <strong>
            Local<small>Your files, on your computer</small>
          </strong>
        </div>
      </div>
      <div className="section-heading">
        <div>
          <h2>Start with a template</h2>
          <p>A complete starting point. Make it your own.</p>
        </div>
        <span className="small-label">{vm.templates.length} TEMPLATES</span>
      </div>
      <div className="template-grid">
        {vm.templates.map((item) => (
          <article
            className={`template-card ${item.id.includes("pvinsight") ? "pvi" : ""}`}
            key={item.project}
          >
            <div className="template-art">
              <span className="template-badge">
                <Sparkles size={12} />
                TEMPLATE
              </span>
              {item.id.includes("pvinsight") ? (
                <div className="pvi-art">
                  <div className="solar-rows">
                    {[0, 1, 2, 3].map((n) => (
                      <i key={n} />
                    ))}
                  </div>
                  <div className="power-point" />
                  <div className="art-text">
                    FROM GENERATION
                    <br />
                    <b>TO GRID.</b>
                  </div>
                </div>
              ) : (
                <div className="motion-art">
                  <div className="motion-route" />
                  <div className="motion-dot" />
                  <span>
                    MOTION
                    <br />
                    <b>IN EVERY FRAME.</b>
                  </span>
                </div>
              )}
              <span className="art-duration">
                {item.duration}s · {item.canvas.width} × {item.canvas.height}
              </span>
            </div>
            <div className="template-card-body">
              <div>
                <h3>
                  {item.id.includes("pvinsight")
                    ? "PVI · Blueprint to Reality"
                    : "Basic motion"}
                </h3>
                <p>
                  {item.id.includes("pvinsight")
                    ? "Engineering, connected. A complete branded film."
                    : "A clean canvas for text, paths, and movement."}
                </p>
              </div>
              <button
                className="button secondary"
                onClick={() => newProject(item.project)}
              >
                <Copy size={14} />
                Use template
                <ArrowUpRight size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className="section-heading">
        <div>
          <h2>Your projects</h2>
          <p>Pick up where you left off.</p>
        </div>
        <button
          className="button text"
          onClick={() => void vm.refresh().catch(vm.fail)}
        >
          Refresh
        </button>
      </div>
      <div className="project-list">
        {vm.projects.map((item) => (
          <button
            className={`project-row ${vm.bundle?.project === item.project ? "current" : ""}`}
            key={item.project}
            onClick={() => void vm.open(item.project)}
          >
            <span className="project-thumbnail">
              <Film size={24} />
            </span>
            <span className="project-row-name">
              <strong>{item.name}</strong>
              <small>
                {item.canvas.width} × {item.canvas.height} · {item.fps} fps ·{" "}
                {item.duration}s
              </small>
            </span>
            {vm.bundle?.project === item.project && (
              <span className="pill mint">OPEN</span>
            )}
            <span className="project-date">
              {new Date(item.modifiedAt * 1000).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
            <ArrowUpRight size={17} />
          </button>
        ))}
      </div>
      {vm.project && (
        <div className="project-settings card">
          <Section title="Current project settings">
            <div className="settings-grid">
              <TextField
                label="Project name"
                value={vm.project.name}
                onChange={(value) =>
                  vm.edit((documents) => {
                    projectDoc(documents).name = value;
                  })
                }
              />
              <TextField
                label="Project ID"
                value={vm.project.id}
                disabled
                onChange={() => undefined}
              />
              <NumberField
                label="Canvas width"
                value={vm.project.canvas.width}
                min={2}
                onChange={(value) =>
                  vm.edit((documents) => {
                    projectDoc(documents).canvas.width = value;
                  })
                }
              />
              <NumberField
                label="Canvas height"
                value={vm.project.canvas.height}
                min={2}
                onChange={(value) =>
                  vm.edit((documents) => {
                    projectDoc(documents).canvas.height = value;
                  })
                }
              />
              <NumberField
                label="Duration (seconds)"
                value={vm.project.timeline.duration}
                min={0.1}
                step={0.1}
                onChange={(value) =>
                  vm.edit((documents) => {
                    projectDoc(documents).timeline.duration = value;
                  })
                }
              />
              <SelectField
                label="Frame rate"
                value={String(vm.project.timeline.fps)}
                onChange={(value) =>
                  vm.edit((documents) => {
                    projectDoc(documents).timeline.fps = +value;
                  })
                }
              >
                {[12, 24, 25, 30, 48, 50, 60].map((value) => (
                  <option key={value} value={value}>
                    {value} fps
                  </option>
                ))}
              </SelectField>
            </div>
            <p className="field-note">
              Changing the canvas or duration keeps your existing layout and
              track timings. Validate the project after making changes.
            </p>
          </Section>
        </div>
      )}
      {modal && (
        <Modal title="Create a project" onClose={() => setModal(false)}>
          <p className="modal-intro">
            Choose a starting point. Templates are copied so the original stays
            reusable.
          </p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                name.trim() &&
                (await vm.create(name.trim(), template || undefined))
              )
                setModal(false);
            }}
          >
            <TextField
              label="Project name"
              value={name}
              onChange={setName}
              placeholder="My next video"
            />
            <SelectField
              label="Starting point"
              value={template}
              onChange={setTemplate}
            >
              <option value="">Blank project</option>
              {vm.templates.map((item) => (
                <option key={item.project} value={item.project}>
                  {item.name}
                </option>
              ))}
            </SelectField>
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="button primary"
                disabled={!name.trim() || !!vm.busy}
              >
                {vm.busy ? (
                  <Spinner label="Creating" />
                ) : (
                  <>
                    <FolderOpen size={15} />
                    Create project
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
