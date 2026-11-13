import { useEffect, useRef } from "react";
import { Plus, ArrowLeft, ArrowRight, Focus, Copy, Trash2 } from "lucide-react";
import { useBuilder } from "../viewmodels/BuilderContext";
import {
  sceneEntries,
  timelineDoc,
  projectDoc,
  uniqueId,
  assetDoc,
  brandingDoc,
} from "../viewmodels/projectModel";
import {
  layouts,
  compositions,
  bindings,
  resizeScene,
  editableEntries,
  sceneLabel,
  assignLayout,
} from "../viewmodels/presentationModel";
import { CanvasStage } from "../components/CanvasStage";
import { Transport } from "../components/Transport";
import {
  Empty,
  Section,
  NumberField,
  TextField,
  SelectField,
} from "../components/Fields";
import type { Scene, Rect, Clip } from "../models/types";
export function SceneStoryboardView() {
  const vm = useBuilder(),
    drag = useRef<{
      x: number;
      duration: number;
      pixels: number;
      total: number;
      clip: string;
    } | null>(null);
  useEffect(() => {
    if (vm.bundle) {
      const list = sceneEntries(vm.bundle.documents);
      if (!list.some((x) => x.scene.id === vm.sceneId) && list[0])
        vm.selectScene(list[0].scene.id);
    }
  }, [vm.bundle?.project, vm.sceneId]);
  if (!vm.bundle || !vm.project)
    return (
      <Empty
        title="Build a scene sequence"
        detail="Open or create a project to start."
      />
    );
  const docs = vm.bundle.documents,
    project = vm.project,
    timeline = timelineDoc(docs),
    clips = [...timeline.clips].sort((a, b) => a.start - b.start),
    clip = clips.find((c) => c.scene === vm.sceneId) ?? clips[0],
    entry = sceneEntries(docs).find((x) => x.scene.id === clip?.scene),
    scene = entry?.scene,
    design = layouts(docs).find((x) => x.design.id === scene?.layout)?.design,
    comp = compositions(docs).find(
      (x) => x.composition.id === scene?.composition,
    )?.composition;
  const change = (fn: (s: Scene) => void) =>
    vm.edit((d) => {
      if (entry) fn(d[entry.file] as Scene);
    });
  const focus: Rect = scene?.camera?.focus ?? {
    x: 0,
    y: 0,
    width: comp?.canvas.width ?? project.canvas.width,
    height: comp?.canvas.height ?? project.canvas.height,
  };
  const setFocus = (r: Rect) =>
    change((s) => {
      s.camera = { ...s.camera, focus: r };
    });
  const move = (delta: number) => {
    const index = clips.findIndex((c) => c.id === clip.id),
      to = index + delta;
    if (to < 0 || to >= clips.length) return;
    vm.edit((d) => {
      const t = timelineDoc(d);
      const sorted = [...t.clips].sort((a, b) => a.start - b.start);
      [sorted[index], sorted[to]] = [sorted[to], sorted[index]];
      let at = 0;
      for (const item of sorted) {
        item.start = at;
        at += item.duration;
      }
      t.clips = sorted;
    });
  };
  const removeScene = () => {
    if (!entry || clips.length <= 1) return;
    const next = clips.find((c) => c.id !== clip.id)!;
    vm.edit((d) => {
      const p = projectDoc(d),
        t = timelineDoc(d);
      t.clips = t.clips.filter((c) => c.id !== clip.id);
      t.tracks = t.tracks?.filter(
        (track) => !track.target.startsWith(clip.id + "/"),
      );
      if (!t.clips.some((c) => c.scene === scene!.id)) {
        p.scenes = p.scenes.filter((file) => file !== entry.file);
        delete d[entry.file];
      }
      let at = 0;
      for (const c of [...t.clips].sort((a, b) => a.start - b.start)) {
        c.start = at;
        at += c.duration;
      }
      p.timeline.duration = at;
    });
    vm.selectScene(next.scene);
  };
  const duplicate = () => {
    if (!scene) return;
    const id = uniqueId(scene.id + "-copy", [
      ...sceneEntries(docs).map((x) => x.scene.id),
      ...editableEntries(docs).map((x) => x.scene.id),
    ]);
    vm.edit((d) => {
      const p = projectDoc(d),
        file = `scenes/${id}.json`,
        t = timelineDoc(d),
        start = Math.max(...t.clips.map((c) => c.start + c.duration));
      d[file] = { ...structuredClone(scene), id };
      p.scenes.push(file);
      t.clips.push({
        ...clip,
        id: uniqueId(
          id,
          t.clips.map((c) => c.id),
        ),
        scene: id,
        start,
      });
      p.timeline.duration = start + clip.duration;
    });
  };
  return (
    <div className="storyboard-layout">
      <main className="storyboard-main">
        <div className="compact-heading">
          <div>
            <h1>Scenes</h1>
            <p>Choose a layout. Tell the story. Frame the view.</p>
          </div>
          <div className="heading-actions">
            <button
              className="icon-button danger"
              aria-label="Remove scene"
              onClick={removeScene}
              disabled={clips.length <= 1}
            >
              <Trash2 size={16} />
            </button>
            <button
              className="button secondary"
              onClick={duplicate}
              disabled={!scene}
            >
              <Copy size={14} />
              Duplicate
            </button>
            <button className="button primary" onClick={vm.newScene}>
              <Plus size={15} />
              Add scene
            </button>
          </div>
        </div>
        <CanvasStage interactive={false} />
        <Transport />
        <div className="storyboard-strip">
          <div className="section-heading">
            <span className="small-label">
              SCENE SEQUENCE · {project.timeline.duration}s
            </span>
            <span className="field-note">
              Select a scene · Drag its right edge to change duration
            </span>
          </div>
          <div className="scene-blocks">
            {clips.map((c, index) => {
              const s = sceneEntries(docs).find(
                (x) => x.scene.id === c.scene,
              )?.scene;
              return (
                <div
                  key={c.id}
                  className={`scene-block ${clip?.id === c.id ? "selected" : ""}`}
                  style={{ flexGrow: c.duration, flexBasis: 0 }}
                >
                  <button onClick={() => vm.selectScene(c.scene)}>
                    <span>
                      {String(index + 1).padStart(2, "0")} · {c.duration}s
                    </span>
                    <strong>{s ? sceneLabel(docs, s) : c.scene}</strong>
                    <small>
                      {c.start.toFixed(2)}s —{" "}
                      {(c.start + c.duration).toFixed(2)}s
                    </small>
                  </button>
                  <button
                    className="scene-edge"
                    aria-label={`Resize scene ${c.scene}`}
                    onPointerDown={(e) => {
                      drag.current = {
                        x: e.clientX,
                        duration: c.duration,
                        pixels:
                          e.currentTarget.parentElement!.parentElement!.getBoundingClientRect()
                            .width,
                        total: project.timeline.duration,
                        clip: c.id,
                      };
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                      const state = drag.current;
                      if (!state) return;
                      const seconds = Math.max(
                        1 / project.timeline.fps,
                        Math.round(
                          (state.duration +
                            ((e.clientX - state.x) / state.pixels) *
                              state.total) *
                            project.timeline.fps,
                        ) / project.timeline.fps,
                      );
                      vm.edit((d) => resizeScene(d, state.clip, seconds));
                    }}
                    onPointerUp={() => {
                      drag.current = null;
                    }}
                    onPointerCancel={() => {
                      drag.current = null;
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </main>
      <aside className="inspector scene-settings">
        <div className="panel-heading">
          <Focus size={15} />
          <h2>Scene settings</h2>
        </div>
        <div className="inspector-scroll">
          {scene && clip && (
            <>
              <Section title={scene.id}>
                <div className="field-row">
                  <button
                    className="button secondary"
                    onClick={() => move(-1)}
                    disabled={clips[0].id === clip.id}
                  >
                    <ArrowLeft size={13} />
                    Earlier
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => move(1)}
                    disabled={clips.at(-1)?.id === clip.id}
                  >
                    Later
                    <ArrowRight size={13} />
                  </button>
                </div>
                <NumberField
                  label="Scene duration (s)"
                  value={clip.duration}
                  min={1 / project.timeline.fps}
                  step={1 / project.timeline.fps}
                  onChange={(v) =>
                    vm.edit((d) =>
                      resizeScene(
                        d,
                        clip.id,
                        Math.round(v * project.timeline.fps) /
                          project.timeline.fps,
                      ),
                    )
                  }
                />
                <SelectField
                  label="Scene layout"
                  value={scene.layout ?? ""}
                  onChange={(v) => vm.edit((d) => assignLayout(d, scene.id, v))}
                >
                  <option value="" disabled>
                    Legacy scene · edit in Layout Design
                  </option>
                  {layouts(docs).map((x) => (
                    <option key={x.design.id} value={x.design.id}>
                      {x.design.name}
                    </option>
                  ))}
                </SelectField>
                {!design && (
                  <p className="field-note">
                    This is an existing element scene. Keep editing it in Layout
                    Design, or add a new scene to use reusable layouts and
                    camera focus.
                  </p>
                )}
              </Section>
              {design && (
                <>
                  <Section title="Scene content">
                    {bindings(design).map((e) =>
                      e.type === "text" ? (
                        <TextField
                          key={e.id}
                          label={e.binding!}
                          value={scene.values?.[e.binding!] ?? e.text ?? ""}
                          onChange={(v) =>
                            change((s) => {
                              (s.values ??= {})[e.binding!] = v;
                            })
                          }
                        />
                      ) : (
                        <SelectField
                          key={e.id}
                          label={e.binding!}
                          value={
                            scene.values?.[e.binding!] ??
                            (e.binding === "logo"
                              ? (brandingDoc(docs).logo ?? "")
                              : "")
                          }
                          onChange={(v) =>
                            change((s) => {
                              (s.values ??= {})[e.binding!] = v;
                            })
                          }
                        >
                          <option value="">None / default</option>
                          {assetDoc(docs)
                            .assets.filter((a) => a.type === e.type)
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.id}
                              </option>
                            ))}
                        </SelectField>
                      ),
                    )}
                  </Section>
                  <Section title="Active navigation">
                    <SelectField
                      label="Highlighted navigation label"
                      value={scene.activeNavigationItem ?? ""}
                      onChange={(v) =>
                        change((s) => {
                          s.activeNavigationItem = v;
                        })
                      }
                    >
                      <option value="">None</option>
                      <option value="*">All labels</option>
                      {design.navigation?.items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </SelectField>
                  </Section>
                  <Section title="Image area & camera">
                    <SelectField
                      label="Shared composition"
                      value={scene.composition ?? ""}
                      onChange={(v) =>
                        change((s) => {
                          s.composition = v;
                          delete s.camera?.focus;
                        })
                      }
                    >
                      {compositions(docs).map((x) => (
                        <option key={x.composition.id} value={x.composition.id}>
                          {x.composition.name}
                        </option>
                      ))}
                    </SelectField>
                    <div className="field-row">
                      {(["x", "y", "width", "height"] as const).map((key) => (
                        <NumberField
                          key={key}
                          label={`Focus ${key}`}
                          value={focus[key]}
                          min={key === "width" || key === "height" ? 1 : 0}
                          onChange={(v) => setFocus({ ...focus, [key]: v })}
                        />
                      ))}
                    </div>
                    <div className="field-row">
                      <NumberField
                        label="Camera movement (s)"
                        value={scene.camera?.transition ?? 1.3}
                        min={0}
                        max={clip.duration}
                        step={0.1}
                        onChange={(v) =>
                          change((s) => {
                            (s.camera ??= {}).transition = v;
                          })
                        }
                      />
                      <SelectField
                        label="Focus fit"
                        value={scene.camera?.fit ?? "fill"}
                        onChange={(v) =>
                          change((s) => {
                            (s.camera ??= {}).fit = v as "fill" | "contain";
                          })
                        }
                      >
                        <option value="fill">Fill viewport</option>
                        <option value="contain">Fit whole rectangle</option>
                      </SelectField>
                    </div>
                    <SelectField
                      label="Camera easing"
                      value={scene.camera?.easing ?? "easeInOut"}
                      onChange={(v) =>
                        change((s) => {
                          (s.camera ??= {}).easing = v;
                        })
                      }
                    >
                      {["linear", "easeIn", "easeOut", "easeInOut"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </SelectField>
                    <button
                      className="button secondary full"
                      onClick={() =>
                        vm.setTime(
                          Math.min(
                            project.timeline.duration -
                              1 / project.timeline.fps,
                            Math.ceil(
                              (clip.start + (scene.camera?.transition ?? 1.3)) *
                                project.timeline.fps,
                            ) / project.timeline.fps,
                          ),
                        )
                      }
                    >
                      <Focus size={14} />
                      View target framing
                    </button>
                    {comp && (
                      <button
                        className="button text"
                        onClick={() => setFocus({ x: 0, y: 0, ...comp.canvas })}
                      >
                        Reset focus to full composition
                      </button>
                    )}
                  </Section>
                  {comp && (
                    <Section title="Draw focus rectangle">
                      <p className="field-note">
                        Drag to draw a rectangle. Drag inside to move it, or
                        drag its bottom-right corner to resize. Coordinates use
                        the source composition.
                      </p>
                      <div className="focus-picker">
                        <CanvasStage
                          authoring
                          sourceId={comp.id}
                          interactive={false}
                          focusRect={focus}
                          onFocusRectChange={setFocus}
                        />
                      </div>
                    </Section>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
