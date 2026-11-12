import { useState } from "react";
import { ScanLine, MonitorPlay, Download, CheckCircle2 } from "lucide-react";
import { useBuilder } from "../viewmodels/BuilderContext";
import { CanvasStage } from "../components/CanvasStage";
import { Transport } from "../components/Transport";
import { Empty, PageHeading, Spinner, formatTime } from "../components/Fields";

export function PreviewView() {
  const vm = useBuilder(),
    [mode, setMode] = useState<"fast" | "engine">("fast");
  if (!vm.project)
    return (
      <Empty
        title="See your story take shape"
        detail="Open a project to preview your video."
      />
    );
  return (
    <div className="preview-page">
      <PageHeading
        title="Before the final frame"
        subtitle="Scrub through the interactive preview, then check a frame with the rendering engine."
      >
        <button
          className="button primary"
          disabled={!!vm.busy}
          onClick={async () => {
            await vm.renderFrame();
            setMode("engine");
          }}
        >
          {vm.busy.includes("preview") ? (
            <Spinner label="Rendering frame" />
          ) : (
            <>
              <ScanLine size={16} />
              Render engine frame
            </>
          )}
        </button>
      </PageHeading>
      <div className="preview-mode-row">
        <div className="segmented">
          <button
            className={mode === "fast" ? "selected" : ""}
            onClick={() => setMode("fast")}
          >
            <MonitorPlay size={14} />
            Interactive
          </button>
          <button
            className={mode === "engine" ? "selected" : ""}
            onClick={() => setMode("engine")}
          >
            <CheckCircle2 size={14} />
            Engine frame
          </button>
        </div>
        <span className="small-label">
          {mode === "fast"
            ? "FAST VISUAL PREVIEW"
            : vm.previewTime !== null
              ? `RENDERED AT ${formatTime(vm.previewTime, vm.project.timeline.fps)}`
              : "EXACT RENDER OUTPUT"}
        </span>
      </div>
      <div className="preview-stage">
        {mode === "fast" ? (
          <CanvasStage interactive={false} />
        ) : vm.previewUrl ? (
          <div className="engine-frame">
            <img
              src={vm.previewUrl}
              alt={`Engine-rendered preview at ${vm.previewTime} seconds`}
            />
            <div>
              <span>
                Still frame at{" "}
                {formatTime(vm.previewTime ?? 0, vm.project.timeline.fps)}.
                Re-render after editing or changing the playhead.
              </span>
              <a
                className="button text"
                href={vm.previewUrl}
                download={`preview-${vm.previewTime}.png`}
              >
                <Download size={14} />
                Save frame
              </a>
            </div>
          </div>
        ) : (
          <Empty
            title="Check a frame with the engine"
            detail="Set the playhead, then click Render engine frame. This checks fonts, effects, and layout against the actual export."
          />
        )}
      </div>
      <Transport />
      <div className="preview-note">
        <span className="status-dot mint" />
        <span>
          The interactive preview uses your browser. Engine frames show the
          actual exported appearance.
        </span>
      </div>
    </div>
  );
}
