import { useState } from "react";
import {
  Download,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Film,
  LoaderCircle,
  ArrowUpRight,
  FolderOpen,
} from "lucide-react";
import { useBuilder } from "../viewmodels/BuilderContext";
import { exportDoc, timelineDoc } from "../viewmodels/projectModel";
import { api } from "../services/api";
import {
  PageHeading,
  Empty,
  Section,
  TextField,
  NumberField,
  SelectField,
  Toggle,
  Modal,
} from "../components/Fields";

export function ExportView() {
  const vm = useBuilder(),
    [watch, setWatch] = useState("");
  if (!vm.bundle || !vm.project)
    return (
      <Empty
        title="Your next finished video"
        detail="Open a project before exporting."
      />
    );
  const settings = exportDoc(vm.bundle.documents),
    canvas = vm.project.canvas,
    resolution = settings.resolution ?? canvas,
    audio = timelineDoc(vm.bundle.documents).audio ?? [];
  const ownActive = vm.jobs.find(
    (job) =>
      job.project === vm.project!.id &&
      ["queued", "running"].includes(job.status),
  );
  const ownJobs = vm.jobs.filter((job) => job.project === vm.project!.id);
  return (
    <div className="page-scroll">
      <PageHeading
        title="Ready for the big screen"
        subtitle="Check your settings, then turn your project into a finished video."
      >
        <button
          className="button secondary"
          onClick={() => void vm.validate()}
          disabled={!!vm.busy}
        >
          <CheckCircle2 size={16} />
          Validate
        </button>
        <button
          className="button primary"
          onClick={() => void vm.render()}
          disabled={!!vm.busy || !!ownActive}
        >
          {ownActive ? (
            <>
              <LoaderCircle size={16} className="spin" />
              Export in progress
            </>
          ) : (
            <>
              <Download size={17} />
              Render video
            </>
          )}
        </button>
      </PageHeading>
      <div className="export-layout">
        <div className="card export-settings">
          <Section title="Output">
            <TextField
              label="Video filename"
              value={settings.filename}
              onChange={(value) =>
                vm.edit((documents) => {
                  exportDoc(documents).filename = value;
                })
              }
            />
            <div className="resolution-presets">
              {[
                [1920, 1080, "1080p"],
                [1280, 720, "720p"],
                [1080, 1920, "Portrait"],
                [1080, 1080, "Square"],
              ].map(([width, height, label]) => (
                <button
                  key={label}
                  className={
                    resolution.width === width && resolution.height === height
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    vm.edit((documents) => {
                      exportDoc(documents).resolution = {
                        width: +width,
                        height: +height,
                      };
                    })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="field-row">
              <NumberField
                label="Export width"
                value={resolution.width}
                min={2}
                step={2}
                onChange={(value) =>
                  vm.edit((documents) => {
                    const current = exportDoc(documents);
                    current.resolution = {
                      width: value,
                      height: current.resolution?.height ?? canvas.height,
                    };
                  })
                }
              />
              <NumberField
                label="Export height"
                value={resolution.height}
                min={2}
                step={2}
                onChange={(value) =>
                  vm.edit((documents) => {
                    const current = exportDoc(documents);
                    current.resolution = {
                      width: current.resolution?.width ?? canvas.width,
                      height: value,
                    };
                  })
                }
              />
            </div>
            <p className="field-note">
              Export resolution scales the canvas. Change the canvas in Projects
              when you need a different layout or aspect ratio.
            </p>
            <SelectField
              label="Encoding speed"
              value={settings.video?.preset ?? "fast"}
              onChange={(value) =>
                vm.edit((documents) => {
                  (exportDoc(documents).video ??= {}).preset = value;
                })
              }
            >
              {["ultrafast", "veryfast", "fast", "medium", "slow"].map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </SelectField>
            <div className="quality-control">
              <label htmlFor="quality">
                Quality <strong>CRF {settings.video?.quality ?? 18}</strong>
              </label>
              <input
                id="quality"
                aria-label="Video quality"
                type="range"
                min={0}
                max={40}
                step={1}
                value={settings.video?.quality ?? 18}
                onChange={(event) =>
                  vm.edit((documents) => {
                    (exportDoc(documents).video ??= {}).quality =
                      +event.target.value;
                  })
                }
              />
              <div>
                <small>Higher quality</small>
                <small>Smaller file</small>
              </div>
            </div>
          </Section>
          <Section title="Sound & looping">
            <Toggle
              label="Include audio"
              checked={settings.audio?.enabled ?? false}
              hint={
                audio.length
                  ? `${audio.length} audio track${audio.length === 1 ? "" : "s"} in this project`
                  : "No audio tracks yet. Add one in Timeline."
              }
              onChange={(value) =>
                vm.edit((documents) => {
                  (exportDoc(documents).audio ??= {}).enabled = value;
                })
              }
            />
            <Toggle
              label="Check the loop join"
              checked={settings.loop?.validateSeam ?? false}
              hint="Compare the first and last frame after rendering."
              onChange={(value) =>
                vm.edit((documents) => {
                  (exportDoc(documents).loop ??= {}).validateSeam = value;
                })
              }
            />
          </Section>
        </div>
        <div className="export-right">
          <div className="export-summary card">
            <div className="export-icon">
              <Film size={28} />
            </div>
            <p className="eyebrow">YOUR VIDEO</p>
            <h2>{vm.project.name}</h2>
            <div className="export-stats">
              <div>
                <strong>
                  {resolution.width} × {resolution.height}
                </strong>
                <small>RESOLUTION</small>
              </div>
              <div>
                <strong>{vm.project.timeline.duration}s</strong>
                <small>DURATION</small>
              </div>
              <div>
                <strong>{vm.project.timeline.fps}</strong>
                <small>FRAMES / SEC</small>
              </div>
              <div>
                <strong>MP4</strong>
                <small>H.264 VIDEO</small>
              </div>
            </div>
            <p>
              <FolderOpen size={15} />
              Saved locally in output/jobs
            </p>
            <small>
              Rendering runs in the background. Keep building in any tab and
              download the video when it is ready.
            </small>
          </div>
          {ownActive && (
            <div className="active-render card">
              <div className="effect-heading">
                <strong>
                  <LoaderCircle size={16} className="spin" />
                  {ownActive.status === "queued"
                    ? "Waiting in queue"
                    : "Rendering your video"}
                </strong>
                <b>{Math.round(ownActive.progress * 100)}%</b>
              </div>
              <div className="progress-track">
                <i style={{ width: `${ownActive.progress * 100}%` }} />
              </div>
              <p className="muted">
                {ownActive.status === "queued"
                  ? "One video is rendered at a time."
                  : "Progress is updated as frames are completed."}
              </p>
            </div>
          )}
          <div className="card render-history">
            <Section title="Render history">
              {ownJobs.length ? (
                ownJobs.map((job) => (
                  <div className="history-item" key={job.id}>
                    <span className={`history-status ${job.status}`}>
                      {job.status === "completed" ? (
                        <CheckCircle2 size={18} />
                      ) : job.status === "failed" ? (
                        <AlertCircle size={18} />
                      ) : (
                        <Clock3 size={18} />
                      )}
                    </span>
                    <div>
                      <strong>
                        {job.status === "completed"
                          ? "Video ready"
                          : job.status === "failed"
                            ? "Export failed"
                            : job.status === "queued"
                              ? "Queued"
                              : `Rendering · ${Math.round(job.progress * 100)}%`}
                      </strong>
                      <small>
                        {job.createdAt
                          ? new Date(job.createdAt).toLocaleString()
                          : job.id.slice(0, 8)}
                      </small>
                      {job.error && <p className="inline-error">{job.error}</p>}
                      {job.manifest?.loopSeam && (
                        <small
                          className={
                            job.manifest.loopSeam.passes
                              ? "mint-text"
                              : "gold-text"
                          }
                        >
                          {job.manifest.loopSeam.passes
                            ? "Loop endpoints match"
                            : "Loop endpoints differ — check the timing"}
                        </small>
                      )}
                    </div>
                    {job.status === "completed" && (
                      <div className="history-actions">
                        <button
                          className="icon-button"
                          aria-label={`Watch video ${job.id}`}
                          onClick={() => setWatch(job.id)}
                        >
                          <Play size={16} />
                        </button>
                        <a
                          className="button secondary"
                          href={api.video(job.id)}
                          download={settings.filename}
                        >
                          <Download size={14} />
                          Download
                        </a>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="muted">
                  Your completed exports will appear here.
                </p>
              )}
            </Section>
          </div>
        </div>
      </div>
      {watch && (
        <Modal title="Your finished video" onClose={() => setWatch("")} wide>
          <video
            className="finished-video"
            src={api.video(watch)}
            controls
            autoPlay
          />
          <div className="modal-actions">
            <a
              className="button primary"
              href={api.video(watch)}
              download={settings.filename}
            >
              <Download size={15} />
              Download MP4
            </a>
          </div>
        </Modal>
      )}
    </div>
  );
}
