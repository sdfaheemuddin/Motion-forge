import {
  FolderOpen,
  Images,
  Palette,
  PanelsTopLeft,
  Clapperboard,
  MonitorPlay,
  Download,
  Undo2,
  Redo2,
  Code2,
  CheckCircle2,
  Save,
  X,
  AlertTriangle,
  LoaderCircle,
  ArrowRight,
  Circle,
} from "lucide-react";
import { useBuilder, BuilderProvider } from "./viewmodels/BuilderContext";
import { ProjectsView } from "./views/ProjectsView";
import { AssetsView } from "./views/AssetsView";
import { BrandingView } from "./views/BrandingView";
import { LayoutDesignView } from "./views/ScenesView";
import { SceneStoryboardView } from "./views/SceneStoryboardView";
import { TimelineView } from "./views/TimelineView";
import { PreviewView } from "./views/PreviewView";
import { ExportView } from "./views/ExportView";
import { JsonDrawer } from "./components/JsonDrawer";
import type { Tab } from "./models/types";

const tabs: { id: Tab; label: string; icon: typeof FolderOpen }[] = [
  { id: "projects", label: "Projects", icon: FolderOpen },
  { id: "assets", label: "Assets", icon: Images },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "layouts", label: "Layout Design", icon: PanelsTopLeft },
  { id: "scenes", label: "Scenes", icon: Clapperboard },
  { id: "timeline", label: "Timeline", icon: Clapperboard },
  { id: "preview", label: "Preview", icon: MonitorPlay },
  { id: "export", label: "Export", icon: Download },
];
function Workspace() {
  const vm = useBuilder();
  const views = {
      projects: ProjectsView,
      assets: AssetsView,
      branding: BrandingView,
      layouts: LayoutDesignView,
      scenes: SceneStoryboardView,
      timeline: TimelineView,
      preview: PreviewView,
      export: ExportView,
    },
    View = views[vm.tab];
  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          href="#"
          className="brand"
          onClick={(event) => {
            event.preventDefault();
            vm.setTab("projects");
          }}
          aria-label="Motion Forge workspace"
        >
          <span className="brand-symbol">
            <i />
            <i />
            <i />
          </span>
          <span>
            MOTION<span className="brand-light">FORGE</span>
            <small>VIDEO BUILDER</small>
          </span>
        </a>
        <span className="header-divider" />
        <div className="header-project">
          <strong>{vm.project?.name ?? "Your creative workspace"}</strong>
          <span>
            {vm.project
              ? `${vm.project.canvas.width} × ${vm.project.canvas.height} · ${vm.project.timeline.fps} fps · ${vm.project.timeline.duration}s`
              : "Local · single user"}
          </span>
        </div>
        <div className="header-actions">
          <span className={`save-status ${vm.dirty ? "unsaved" : ""}`}>
            <i />
            {vm.dirty
              ? "Unsaved changes"
              : vm.bundle
                ? "All changes saved"
                : "Ready"}
          </span>
          <div className="history-buttons">
            <button
              className="icon-button"
              aria-label="Undo"
              title="Undo · Ctrl+Z"
              disabled={!vm.history.past.length || !!vm.busy}
              onClick={vm.undo}
            >
              <Undo2 size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Redo"
              title="Redo · Ctrl+Shift+Z"
              disabled={!vm.history.future.length || !!vm.busy}
              onClick={vm.redo}
            >
              <Redo2 size={17} />
            </button>
          </div>
          <button
            className="icon-button"
            aria-label="Advanced JSON"
            title="Advanced JSON"
            disabled={!vm.bundle}
            onClick={() => vm.setShowJson(true)}
          >
            <Code2 size={18} />
          </button>
          <button
            className="button secondary validate-button"
            disabled={!vm.bundle || !!vm.busy}
            onClick={() => void vm.validate()}
          >
            <CheckCircle2 size={15} />
            Validate
          </button>
          <button
            className="button primary"
            disabled={!vm.bundle || !!vm.busy || vm.bundle.readOnly}
            onClick={() => void vm.save()}
          >
            <Save size={15} />
            Save project
          </button>
        </div>
      </header>
      <nav className="main-tabs" aria-label="Video builder tabs">
        {tabs.map(({ id, label, icon: Icon }, index) => (
          <button
            role="tab"
            aria-selected={vm.tab === id}
            className={vm.tab === id ? "active" : ""}
            key={id}
            onClick={() => vm.setTab(id)}
          >
            <span className="tab-number">
              {String(index + 1).padStart(2, "0")}
            </span>
            <Icon size={16} />
            <span>{label}</span>
            {id === "export" && vm.activeJob && <i className="tab-live-dot" />}
          </button>
        ))}
        <span className="local-badge">
          <span className={`status-dot ${vm.connected ? "mint" : "red"}`} />
          {vm.connected ? "LOCAL WORKSPACE" : "CONNECTION LOST"}
        </span>
      </nav>
      {!vm.connected && (
        <div className="connection-banner">
          <AlertTriangle size={16} />
          <span>
            Could not reach the local server. Check that Motion Forge is
            running.
          </span>
          <button
            className="button text"
            onClick={() => void vm.refresh().catch(vm.fail)}
          >
            Retry connection
          </button>
        </div>
      )}
      {vm.validation && !vm.validation.valid && (
        <details className="validation-panel" open>
          <summary>
            <AlertTriangle size={16} />
            {vm.validation.errors.length} issue
            {vm.validation.errors.length === 1 ? "" : "s"} to resolve before
            export
            <button
              className="icon-button"
              aria-label="Dismiss validation errors"
              onClick={(event) => {
                event.preventDefault();
                vm.setValidation(null);
              }}
            >
              <X size={15} />
            </button>
          </summary>
          <ul>
            {vm.validation.errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="app-content">
        <View />
      </div>
      <footer className="app-status">
        <div>
          <span className={`status-dot ${vm.busy ? "gold" : "mint"}`} />
          {vm.busy ? (
            <>
              <LoaderCircle size={12} className="spin" />
              {vm.busy}
            </>
          ) : (
            <span>
              Motion Forge <span className="muted">/</span>{" "}
              {vm.bundle ? "JSON-driven project" : "Local video studio"}
            </span>
          )}
        </div>
        {vm.activeJob ? (
          <button className="status-job" onClick={() => vm.setTab("export")}>
            <span>
              {vm.activeJob.status === "queued"
                ? "Export queued"
                : "Rendering video"}
            </span>
            <span className="status-progress">
              <i style={{ width: `${vm.activeJob.progress * 100}%` }} />
            </span>
            <strong>{Math.round(vm.activeJob.progress * 100)}%</strong>
            <ArrowRight size={13} />
          </button>
        ) : (
          <span className="status-tip">
            {vm.tab === "scenes"
              ? "Drag to move · Corner to resize · Ctrl+S to save"
              : "Your projects and assets stay on this computer"}
          </span>
        )}
      </footer>
      {vm.toast && (
        <div className="toast" role="status">
          <span>{vm.toast}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => vm.setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      <JsonDrawer />
    </div>
  );
}
export default function App() {
  return (
    <BuilderProvider>
      <Workspace />
    </BuilderProvider>
  );
}
