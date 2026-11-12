import { useState } from "react";
import {
  Plus,
  Type,
  Shapes,
  Route,
  Group,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  AlignCenter,
  Image as ImageIcon,
  Layers3,
  ChevronRight,
  Film,
} from "lucide-react";
import { useBuilder } from "../viewmodels/BuilderContext";
import {
  assetDoc,
  flatten,
  sceneById,
  sceneEntries,
  timelineDoc,
} from "../viewmodels/projectModel";
import { CanvasStage } from "../components/CanvasStage";
import { ElementInspector } from "../components/ElementInspector";
import { Transport } from "../components/Transport";
import { Empty } from "../components/Fields";
import type { VideoElement } from "../models/types";

const typeIcons: Record<string, typeof Type> = {
  text: Type,
  image: ImageIcon,
  video: Film,
  shape: Shapes,
  path: Route,
  group: Group,
};
export function ScenesView() {
  const vm = useBuilder(),
    [filter, setFilter] = useState("");
  if (!vm.bundle)
    return (
      <Empty
        title="Build your first scene"
        detail="Create a project or open one from the workspace."
      />
    );
  const docs = vm.bundle.documents,
    entries = sceneEntries(docs),
    scene = sceneById(docs, vm.sceneId),
    assets = assetDoc(docs).assets;
  const rows: { element: VideoElement; depth: number }[] = [];
  const collect = (elements: VideoElement[], depth = 0) => {
    for (const element of [...elements].sort(
      (a, b) => (b.layer ?? 0) - (a.layer ?? 0),
    )) {
      rows.push({ element, depth });
      if (element.children) collect(element.children, depth + 1);
    }
  };
  collect(scene?.elements ?? []);
  const clip = timelineDoc(docs).clips.find(
    (clip) => clip.scene === vm.sceneId,
  );
  const center = () => {
    if (!vm.selected) return;
    const controlled = (timelineDoc(docs).tracks ?? []).some(
      (track) =>
        track.target === `${clip?.id}/${vm.elementId}` &&
        (track.property === "position" ||
          ["slideIn", "followPath"].includes(track.animation ?? "")),
    );
    if (controlled) {
      vm.setToast(
        "Edit the position animation in Timeline to move this element.",
      );
      return;
    }
    vm.updateElement(vm.elementId, (element) => {
      element.transform = {
        ...element.transform,
        position: [vm.project!.canvas.width / 2, vm.project!.canvas.height / 2],
        anchor: [0.5, 0.5],
      };
    });
  };
  return (
    <div className="editor-layout">
      <aside className="layers-panel">
        <div className="panel-heading">
          <Layers3 size={15} />
          <h2>Scenes & layers</h2>
          <button
            className="icon-button"
            aria-label="Add scene"
            onClick={vm.newScene}
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="scene-selector">
          <select
            aria-label="Selected scene"
            value={vm.sceneId}
            onChange={(event) => vm.selectScene(event.target.value)}
          >
            {entries.map(({ scene }, index) => (
              <option key={scene.id} value={scene.id}>
                {String(index + 1).padStart(2, "0")} · {scene.id}
              </option>
            ))}
          </select>
          <span>
            {clip
              ? `${clip.start}s — ${clip.start + clip.duration}s`
              : "No clip scheduled"}
          </span>
        </div>
        <div className="layers-search">
          <input
            aria-label="Filter layers"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Find a layer…"
          />
          <span>{flatten(scene?.elements ?? []).length}</span>
        </div>
        <div className="layer-list">
          {rows
            .filter(({ element }) =>
              `${element.id} ${element.text ?? ""}`
                .toLowerCase()
                .includes(filter.toLowerCase()),
            )
            .map(({ element, depth }) => {
              const Icon = typeIcons[element.type] ?? Shapes;
              return (
                <button
                  className={`layer-row ${vm.elementId === element.id ? "selected" : ""}`}
                  key={element.id}
                  style={{ paddingLeft: 14 + depth * 15 }}
                  onClick={() => vm.setElementId(element.id)}
                >
                  <Icon size={15} />
                  <span>
                    <strong>
                      {element.text ? element.text.slice(0, 30) : element.id}
                    </strong>
                    <small>{element.id}</small>
                  </span>
                  <span className="layer-order">{element.layer ?? 0}</span>
                </button>
              );
            })}
        </div>
        <div className="layers-footer">
          <span className="small-label">LAYERS DRAW FROM BOTTOM TO TOP</span>
          <button className="button text" onClick={() => vm.setTab("timeline")}>
            Scene timing
            <ChevronRight size={14} />
          </button>
        </div>
      </aside>
      <main className="scene-main">
        <div className="scene-tools">
          <div className="tool-group">
            <button className="tool-button" onClick={() => vm.add("text")}>
              <Type size={16} />
              <span>Text</span>
            </button>
            <button className="tool-button" onClick={() => vm.add("shape")}>
              <Shapes size={16} />
              <span>Shape</span>
            </button>
            <button className="tool-button" onClick={() => vm.add("path")}>
              <Route size={16} />
              <span>Path</span>
            </button>
            <button className="tool-button" onClick={() => vm.add("group")}>
              <Group size={16} />
              <span>Group</span>
            </button>
            <select
              aria-label="Add asset to scene"
              defaultValue=""
              onChange={(event) => {
                const asset = assets.find(
                  (asset) => asset.id === event.target.value,
                );
                if (asset) vm.add(asset.type, asset);
                event.target.value = "";
              }}
            >
              <option value="">+ Add asset</option>
              {assets
                .filter((asset) =>
                  ["image", "video", "path"].includes(asset.type),
                )
                .map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.id}
                  </option>
                ))}
            </select>
          </div>
          <div className="tool-group">
            <button
              className="icon-button"
              aria-label="Center selected element"
              title="Center on canvas"
              disabled={!vm.selected}
              onClick={center}
            >
              <AlignCenter size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Bring element forward"
              disabled={!vm.selected}
              onClick={() =>
                vm.updateElement(vm.elementId, (element) => {
                  element.layer = (element.layer ?? 0) + 1;
                })
              }
            >
              <ArrowUp size={16} />
            </button>
            <button
              className="icon-button"
              aria-label="Send element backward"
              disabled={!vm.selected}
              onClick={() =>
                vm.updateElement(vm.elementId, (element) => {
                  element.layer = (element.layer ?? 0) - 1;
                })
              }
            >
              <ArrowDown size={16} />
            </button>
            <span className="tool-divider" />
            <button
              className="icon-button"
              aria-label="Duplicate selected element"
              title="Duplicate properties as a new element"
              disabled={!vm.selected}
              onClick={vm.duplicateSelected}
            >
              <Copy size={16} />
            </button>
            <button
              className="icon-button danger"
              aria-label="Delete selected element"
              disabled={!vm.selected}
              onClick={vm.removeSelected}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        <CanvasStage />
        <Transport />
      </main>
      <ElementInspector />
    </div>
  );
}
