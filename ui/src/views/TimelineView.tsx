import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Trash2,
  Diamond,
  Route,
  Music2,
  Layers3,
  WandSparkles,
  Clock3,
} from "lucide-react";
import { useBuilder } from "../viewmodels/BuilderContext";
import {
  assetDoc,
  sceneEntries,
  flatten,
  timelineDoc,
  trackInterval,
  shiftTrack,
  uniqueId,
  projectDoc,
} from "../viewmodels/projectModel";
import { CanvasStage } from "../components/CanvasStage";
import { Transport } from "../components/Transport";
import {
  Empty,
  NumberField,
  SelectField,
  TextField,
  Section,
  Modal,
  Field,
} from "../components/Fields";
import type { Track, TrackValue, Vec2 } from "../models/types";

const presets = [
  "fadeIn",
  "fadeOut",
  "slideIn",
  "zoomIn",
  "pulse",
  "followPath",
  "wipeReveal",
  "typewriter",
];
const properties = [
  "opacity",
  "position",
  "scale",
  "rotation",
  "fill",
  "stroke",
  "strokeWidth",
  "reveal",
  "textReveal",
];
const easings = ["linear", "easeIn", "easeOut", "easeInOut"];
function ValueInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: TrackValue;
  onChange: (value: TrackValue) => void;
}) {
  const display = (value: TrackValue) =>
    typeof value === "string" ? value : JSON.stringify(value);
  const [text, setText] = useState(display(value)),
    [error, setError] = useState("");
  useEffect(() => setText(display(value)), [JSON.stringify(value)]);
  return (
    <Field label={label}>
      <input
        aria-label={label}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setError("");
        }}
        onBlur={() => {
          try {
            const parsed = text.startsWith("#") ? text : JSON.parse(text);
            if (
              typeof parsed !== "number" &&
              typeof parsed !== "string" &&
              !(
                Array.isArray(parsed) &&
                parsed.every((item) => typeof item === "number")
              )
            )
              throw new Error();
            onChange(parsed);
          } catch {
            setError("Use a number, [x, y], or hex colour.");
          }
        }}
      />
      {error && <small className="inline-error">{error}</small>}
    </Field>
  );
}
export function TimelineView() {
  const vm = useBuilder(),
    [section, setSection] = useState<"tracks" | "paths" | "audio" | "clips">(
      "tracks",
    ),
    [selectedId, setSelectedId] = useState(""),
    [pathId, setPathId] = useState(""),
    [filter, setFilter] = useState("");
  const [modal, setModal] = useState(false),
    [newTarget, setNewTarget] = useState(""),
    [preset, setPreset] = useState("fadeIn");
  const dragging = useRef<{ track: Track; x: number; width: number } | null>(
    null,
  );
  if (!vm.bundle || !vm.project)
    return (
      <Empty
        title="Bring your scenes to life"
        detail="Open a project to edit its timeline."
      />
    );
  const bundle = vm.bundle,
    project = vm.project,
    timeline = timelineDoc(bundle.documents),
    tracks = timeline.tracks ?? [],
    paths = timeline.paths ?? [];
  const targets = timeline.clips.flatMap((clip) => {
    const scene = sceneEntries(bundle.documents).find(
      (item) => item.scene.id === clip.scene,
    )?.scene;
    return flatten(scene?.elements ?? []).map((element) => ({
      value: `${clip.id}/${element.id}`,
      label: `${clip.scene} / ${element.id}`,
    }));
  });
  const selected =
    tracks.find((track) => track.id === selectedId) ??
    tracks.find((track) => track.target.endsWith(`/${vm.elementId}`)) ??
    tracks[0];
  const selectedPath = paths.find((path) => path.id === pathId) ?? paths[0];
  const updateTrack = (id: string, update: (track: Track) => void) =>
    vm.edit((documents) => {
      const item = timelineDoc(documents).tracks?.find(
        (track) => track.id === id,
      );
      if (item) update(item);
    });
  const targetElement = selected ? timeline.clips.filter(clip => selected.target.startsWith(clip.id + "/")).flatMap(clip => flatten(sceneEntries(bundle.documents).find(item => item.scene.id === clip.scene)?.scene.elements ?? [])).find(element => element.id === selected.target.split("/")[1]) : undefined;
  const effectProperties = targetElement?.effects?.flatMap((effect, index) => ["radius", "intensity", "color"].map(field => `effects.${index}.${field}`)) ?? [];
  const duration = project.timeline.duration;
  const makeTrack = () => {
    const target =
      newTarget ||
      targets.find((target) => target.value.endsWith(`/${vm.elementId}`))
        ?.value ||
      targets[0]?.value;
    if (!target) return;
    const id = uniqueId(
        preset === "keyframes" ? "keyframes" : preset,
        tracks.map((track) => track.id),
      ),
      start = Math.min(vm.time, Math.max(0, duration - 1)),
      length = Math.max(0.01, Math.min(2, duration - start));
    const track: Track =
      preset === "keyframes"
        ? {
            id,
            target,
            property: "opacity",
            keyframes: [
              { time: start, value: 0 },
              { time: start + length, value: 1 },
            ],
          }
        : {
            id,
            target,
            animation: preset,
            start,
            duration: length,
            easing: "linear",
            repeat: 0,
            parameters:
              preset === "followPath"
                ? {
                    path: paths[0]?.id,
                    speedMode: "constant",
                    orientToPath: false,
                  }
                : {},
          };
    vm.edit((documents) => {
      (timelineDoc(documents).tracks ??= []).push(track);
    });
    setSelectedId(id);
    setSection("tracks");
    setModal(false);
  };
  const addPath = () => {
    const id = uniqueId(
      "route",
      paths.map((path) => path.id),
    );
    vm.edit((documents) => {
      (timelineDoc(documents).paths ??= []).push({
        id,
        type: "polyline",
        points: [
          [project.canvas.width * 0.2, project.canvas.height * 0.5],
          [project.canvas.width * 0.8, project.canvas.height * 0.5],
        ],
      });
    });
    setPathId(id);
  };
  const titleActions = (
    <>
      <button
        className="button secondary"
        onClick={() => {
          setSection("paths");
          if (!paths.length) addPath();
        }}
      >
        <Route size={15} />
        Edit paths
      </button>
      <button
        className="button primary"
        onClick={() => {
          setPreset("fadeIn");
          setModal(true);
        }}
      >
        <Plus size={15} />
        Add animation
      </button>
    </>
  );
  return (
    <div className="timeline-layout">
      <main className="timeline-main">
        <div className="compact-heading">
          <div>
            <h1>Timeline & animation</h1>
            <p>One clock. Every movement in sync.</p>
          </div>
          <div className="heading-actions">{titleActions}</div>
        </div>
        <div className="timeline-preview">
          <CanvasStage
            interactive={section === "paths"}
            editPathId={section === "paths" ? selectedPath?.id : undefined}
          />
        </div>
        <Transport />
        <div className="timeline-editor">
          <div className="timeline-header">
            <div className="segmented">
              {(
                [
                  ["tracks", Diamond, "Animations"],
                  ["paths", Route, "Paths"],
                  ["audio", Music2, "Audio"],
                  ["clips", Layers3, "Scenes"],
                ] as const
              ).map(([id, Icon, label]) => (
                <button
                  className={section === id ? "selected" : ""}
                  key={id}
                  onClick={() => setSection(id)}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>
            {section === "tracks" && (
              <input
                aria-label="Filter animation tracks"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter tracks…"
              />
            )}
          </div>
          {section === "tracks" && (
            <div className="tracks-scroll">
              <div className="track-ruler">
                <span>ELEMENT / PROPERTY</span>
                <div>
                  {Array.from({ length: 6 }, (_, index) => (
                    <i key={index} style={{ left: `${index * 20}%` }}>
                      {Math.round(((duration * index) / 5) * 10) / 10}s
                    </i>
                  ))}
                </div>
              </div>
              {tracks
                .filter((track) =>
                  `${track.id} ${track.target}`
                    .toLowerCase()
                    .includes(filter.toLowerCase()),
                )
                .map((track) => {
                  const [start, end] = trackInterval(track);
                  return (
                    <div
                      className={`track-row ${selected?.id === track.id ? "selected" : ""}`}
                      key={track.id}
                    >
                      <button
                        className="track-label"
                        onClick={() => {
                          setSelectedId(track.id);
                          vm.setTime(
                            Math.min(
                              start,
                              duration - 1 / project.timeline.fps,
                            ),
                          );
                        }}
                      >
                        <span
                          className={`track-dot ${track.keyframes ? "gold" : ""}`}
                        />
                        <span>
                          <strong>{track.target.split("/")[1]}</strong>
                          <small>{track.property ?? track.animation}</small>
                        </span>
                      </button>
                      <div className="track-lane">
                        <div
                          className="playhead"
                          style={{ left: `${(vm.time / duration) * 100}%` }}
                        />
                        <button
                          className={`track-bar ${track.keyframes ? "keyframe-bar" : ""}`}
                          aria-label={`Animation ${track.id}`}
                          style={{
                            left: `${(start / duration) * 100}%`,
                            width: `${Math.max(0.5, ((end - start) / duration) * 100)}%`,
                          }}
                          onPointerDown={(event) => {
                            setSelectedId(track.id);
                            dragging.current = {
                              track: structuredClone(track),
                              x: event.clientX,
                              width:
                                event.currentTarget.parentElement!.getBoundingClientRect()
                                  .width,
                            };
                            event.currentTarget.setPointerCapture(
                              event.pointerId,
                            );
                          }}
                          onPointerMove={(event) => {
                            const state = dragging.current;
                            if (!state || state.track.id !== track.id) return;
                            const [a, b] = trackInterval(state.track),
                              raw =
                                ((event.clientX - state.x) / state.width) *
                                duration,
                              delta = Math.max(
                                -a,
                                Math.min(
                                  duration - b,
                                  Math.round(raw * project.timeline.fps) /
                                    project.timeline.fps,
                                ),
                              );
                            const moved = shiftTrack(state.track, delta);
                            updateTrack(track.id, (item) =>
                              Object.assign(item, moved),
                            );
                          }}
                          onPointerUp={() => {
                            dragging.current = null;
                          }}
                          onPointerCancel={() => {
                            dragging.current = null;
                          }}
                        >
                          {track.keyframes?.map((frame, index) => (
                            <span
                              className="keyframe-diamond"
                              key={index}
                              style={{
                                left: `${end === start ? 50 : ((frame.time - start) / (end - start)) * 100}%`,
                              }}
                            />
                          ))}
                          {!track.keyframes && <span>{track.animation}</span>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              {!tracks.length && (
                <Empty
                  title="Give an element some movement"
                  detail="Add an animation preset or property keyframes."
                />
              )}
            </div>
          )}
          {section === "paths" && (
            <div className="path-overview">
              <div>
                <Route size={32} />
                <h3>Shape the journey</h3>
                <p>
                  Select a route, then drag its control points on the canvas.
                  Coordinate fields give you precise control.
                </p>
              </div>
              <div className="path-list">
                {paths.map((path) => (
                  <button
                    key={path.id}
                    className={selectedPath?.id === path.id ? "selected" : ""}
                    onClick={() => setPathId(path.id)}
                  >
                    <Route size={16} />
                    <span>
                      <strong>{path.id}</strong>
                      <small>
                        {path.points.length} points · {path.type ?? "polyline"}
                      </small>
                    </span>
                  </button>
                ))}
                <button className="button secondary" onClick={addPath}>
                  <Plus size={15} />
                  New route
                </button>
              </div>
            </div>
          )}
          {section === "audio" && (
            <div className="audio-editor">
              <button
                className="button secondary"
                onClick={() => {
                  const asset = assetDoc(bundle.documents).assets.find(
                    (asset) => ["audio", "video"].includes(asset.type),
                  );
                  if (!asset) {
                    vm.setToast("Import an audio or video asset first.");
                    vm.setTab("assets");
                    return;
                  }
                  vm.edit((documents) => {
                    const current = timelineDoc(documents);
                    (current.audio ??= []).push({
                      id: uniqueId(
                        "audio",
                        (current.audio ?? []).map((track) => track.id),
                      ),
                      asset: asset.id,
                      start: 0,
                      duration,
                      volume: 0.7,
                      trimStart: 0,
                    });
                  });
                }}
              >
                <Plus size={15} />
                Add audio track
              </button>
              {(timeline.audio ?? []).map((audio, index) => (
                <div className="audio-track-card" key={audio.id}>
                  <div className="effect-heading">
                    <strong>
                      <Music2 size={15} />
                      {audio.id}
                    </strong>
                    <button
                      className="icon-button danger"
                      aria-label={`Remove audio ${audio.id}`}
                      onClick={() =>
                        vm.edit((documents) => {
                          timelineDoc(documents).audio!.splice(index, 1);
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="audio-fields">
                    <SelectField
                      label="Audio source"
                      value={audio.asset}
                      onChange={(value) =>
                        vm.edit((documents) => {
                          timelineDoc(documents).audio![index].asset = value;
                        })
                      }
                    >
                      {assetDoc(bundle.documents)
                        .assets.filter((asset) =>
                          ["audio", "video"].includes(asset.type),
                        )
                        .map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            {asset.id}
                          </option>
                        ))}
                    </SelectField>
                    {(
                      [
                        "start",
                        "duration",
                        "trimStart",
                        "volume",
                        "fadeIn",
                        "fadeOut",
                      ] as const
                    ).map((key) => (
                      <NumberField
                        key={key}
                        label={
                          {
                            start: "Start (s)",
                            duration: "Duration (s)",
                            trimStart: "Trim (s)",
                            volume: "Volume",
                            fadeIn: "Fade in (s)",
                            fadeOut: "Fade out (s)",
                          }[key]
                        }
                        value={audio[key] ?? (key === "volume" ? 1 : 0)}
                        min={key === "duration" ? 0.01 : 0}
                        step={0.1}
                        onChange={(value) =>
                          vm.edit((documents) => {
                            timelineDoc(documents).audio![index][key] = value;
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
              {!timeline.audio?.length && (
                <Empty
                  title="Set the sound of your story"
                  detail="Import audio in Assets, then schedule it here. Enable audio in Export to include it in the video."
                />
              )}
            </div>
          )}
          {section === "clips" && (
            <div className="clips-editor">
              {timeline.clips.map((clip, index) => (
                <div className="clip-edit-row" key={clip.id}>
                  <div>
                    <span className="clip-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <strong>{clip.scene}</strong>
                    <small>{clip.id}</small>
                  </div>
                  <NumberField
                    label="Clip start (s)"
                    value={clip.start}
                    min={0}
                    step={0.1}
                    onChange={(value) =>
                      vm.edit((documents) => {
                        timelineDoc(documents).clips[index].start = value;
                      })
                    }
                  />
                  <NumberField
                    label="Clip duration (s)"
                    value={clip.duration}
                    min={0.01}
                    step={0.1}
                    onChange={(value) =>
                      vm.edit((documents) => {
                        timelineDoc(documents).clips[index].duration = value;
                      })
                    }
                  />
                  <NumberField
                    label="Clip layer"
                    value={clip.layer ?? 0}
                    onChange={(value) =>
                      vm.edit((documents) => {
                        timelineDoc(documents).clips[index].layer = value;
                      })
                    }
                  />
                </div>
              ))}
              <button className="button secondary" onClick={vm.newScene}>
                <Plus size={15} />
                Add a new scene
              </button>
              <p className="field-note">
                Animation and visibility times use the project clock. Moving a
                scene clip keeps those times unchanged.
              </p>
            </div>
          )}
        </div>
      </main>
      <aside className="inspector timeline-inspector">
        <div className="panel-heading">
          {section === "paths" ? (
            <Route size={15} />
          ) : (
            <WandSparkles size={15} />
          )}
          <h2>
            {section === "paths" ? "Route properties" : "Animation properties"}
          </h2>
        </div>
        <div className="inspector-scroll">
          {section === "paths" ? (
            selectedPath ? (
              <>
                <Section title={selectedPath.id}>
                  <SelectField
                    label="Route type"
                    value={selectedPath.type ?? "polyline"}
                    onChange={(value) => {
                      if (
                        value === "bezier" &&
                        (selectedPath.points.length - 1) % 3 !== 0
                      ) {
                        vm.setToast(
                          "A cubic Bezier needs 4, 7, 10… points. Add points before changing the route type.",
                        );
                        return;
                      }
                      vm.edit((documents) => {
                        timelineDoc(documents).paths!.find(
                          (path) => path.id === selectedPath.id,
                        )!.type = value as "polyline" | "bezier";
                      });
                    }}
                  >
                    <option value="polyline">Polyline</option>
                    <option value="bezier">Cubic Bezier</option>
                  </SelectField>
                  <p className="field-note">
                    Used by shared path elements and follow-path animations.
                  </p>
                </Section>
                <Section
                  title="Control points"
                  action={
                    <button
                      className="icon-button"
                      aria-label="Add route point"
                      onClick={() =>
                        vm.edit((documents) => {
                          const path = timelineDoc(documents).paths!.find(
                            (path) => path.id === selectedPath.id,
                          )!;
                          const last = path.points[path.points.length - 1];
                          path.points.push([last[0] + 100, last[1]]);
                        })
                      }
                    >
                      <Plus size={15} />
                    </button>
                  }
                >
                  {selectedPath.points.map((point, index) => (
                    <div className="route-point" key={index}>
                      <span>{index + 1}</span>
                      <NumberField
                        label={`Point ${index + 1} X`}
                        value={point[0]}
                        onChange={(value) =>
                          vm.edit((documents) => {
                            timelineDoc(documents).paths!.find(
                              (path) => path.id === selectedPath.id,
                            )!.points[index][0] = value;
                          })
                        }
                      />
                      <NumberField
                        label={`Point ${index + 1} Y`}
                        value={point[1]}
                        onChange={(value) =>
                          vm.edit((documents) => {
                            timelineDoc(documents).paths!.find(
                              (path) => path.id === selectedPath.id,
                            )!.points[index][1] = value;
                          })
                        }
                      />
                      <button
                        className="icon-button danger"
                        aria-label={`Remove route point ${index + 1}`}
                        disabled={selectedPath.points.length <= 2}
                        onClick={() =>
                          vm.edit((documents) => {
                            timelineDoc(documents)
                              .paths!.find(
                                (path) => path.id === selectedPath.id,
                              )!
                              .points.splice(index, 1);
                          })
                        }
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </Section>
              </>
            ) : (
              <Empty
                title="Create a route"
                detail="Draw a journey for your moving elements."
              />
            )
          ) : selected ? (
            <>
              <Section title={selected.id}>
                <SelectField
                  label="Target element"
                  value={selected.target}
                  onChange={(value) =>
                    updateTrack(selected.id, (track) => {
                      track.target = value;
                    })
                  }
                >
                  {targets.map((target) => (
                    <option key={target.value} value={target.value}>
                      {target.label}
                    </option>
                  ))}
                </SelectField>
                <div className="animation-kind">
                  <WandSparkles size={15} />
                  <strong>
                    {selected.animation ?? `${selected.property} keyframes`}
                  </strong>
                </div>
                {selected.animation && (
                  <>
                    <div className="field-row">
                      <NumberField
                        label="Start (s)"
                        value={selected.start ?? 0}
                        min={0}
                        step={0.1}
                        onChange={(value) =>
                          updateTrack(selected.id, (track) => {
                            track.start = value;
                          })
                        }
                      />
                      <NumberField
                        label="Duration (s)"
                        value={selected.duration ?? 1}
                        min={0.01}
                        step={0.1}
                        onChange={(value) =>
                          updateTrack(selected.id, (track) => {
                            track.duration = value;
                          })
                        }
                      />
                    </div>
                    <SelectField
                      label="Easing"
                      value={selected.easing ?? "linear"}
                      onChange={(value) =>
                        updateTrack(selected.id, (track) => {
                          track.easing = value;
                        })
                      }
                    >
                      {easings.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </SelectField>
                    <NumberField
                      label="Additional repeats"
                      value={selected.repeat ?? 0}
                      min={0}
                      step={1}
                      onChange={(value) =>
                        updateTrack(selected.id, (track) => {
                          track.repeat = value;
                        })
                      }
                    />
                    {selected.animation === "followPath" ? (
                      <>
                        <SelectField
                          label="Motion path"
                          value={
                            selected.path ?? selected.parameters?.path ?? ""
                          }
                          onChange={(value) =>
                            updateTrack(selected.id, (track) => {
                              delete track.path;
                              (track.parameters ??= {}).path = value;
                            })
                          }
                        >
                          <option value="">Choose a route</option>
                          {paths.map((path) => (
                            <option key={path.id}>{path.id}</option>
                          ))}
                        </SelectField>
                        <label className="checkbox-line">
                          <input
                            type="checkbox"
                            checked={selected.parameters?.orientToPath ?? false}
                            onChange={(event) =>
                              updateTrack(selected.id, (track) => {
                                (track.parameters ??= {}).orientToPath =
                                  event.target.checked;
                              })
                            }
                          />
                          Orient to path
                        </label>
                        <button
                          className="button secondary full"
                          onClick={() => {
                            setPathId(
                              selected.path ?? selected.parameters?.path ?? "",
                            );
                            setSection("paths");
                          }}
                        >
                          Edit route points
                          <Route size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <ValueInput
                          label="From value"
                          value={
                            selected.parameters?.from ??
                            (selected.animation === "slideIn"
                              ? [-200, 0]
                              : selected.animation === "zoomIn"
                                ? [0.8, 0.8]
                                : selected.animation === "fadeOut"
                                  ? 1
                                  : 0)
                          }
                          onChange={(value) =>
                            updateTrack(selected.id, (track) => {
                              (track.parameters ??= {}).from = value;
                            })
                          }
                        />
                        <ValueInput
                          label="To value"
                          value={
                            selected.parameters?.to ??
                            (selected.animation === "slideIn"
                              ? [0, 0]
                              : selected.animation === "zoomIn"
                                ? [1, 1]
                                : selected.animation === "fadeOut"
                                  ? 0
                                  : 1)
                          }
                          onChange={(value) =>
                            updateTrack(selected.id, (track) => {
                              (track.parameters ??= {}).to = value;
                            })
                          }
                        />
                      </>
                    )}
                  </>
                )}
                {selected.keyframes && (
                  <>
                    <SelectField
                      label="Animated property"
                      value={selected.property ?? "opacity"}
                      onChange={(value) =>
                        updateTrack(selected.id, (track) => {
                          track.property = value;
                          const vector = ["position", "scale"].includes(value),
                            color = ["fill", "stroke"].includes(value) || value.endsWith(".color");
                          track.keyframes = track.keyframes!.map(
                            (frame, index) => ({
                              ...frame,
                              value: vector
                                ? value === "scale"
                                  ? [1, 1]
                                  : [0, 0]
                                : color
                                  ? "#FFFFFF"
                                  : index
                                    ? 1
                                    : 0,
                            }),
                          );
                        })
                      }
                    >
                      {[
                        ...properties,
                        ...effectProperties.filter(property => property !== selected.property),
                        ...(selected.property?.startsWith("effects.")
                          ? [selected.property]
                          : []),
                      ].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </SelectField>
                    {selected.keyframes.map((frame, index) => (
                      <div className="keyframe-editor" key={index}>
                        <div className="effect-heading">
                          <strong>
                            <Diamond size={12} />
                            Keyframe {index + 1}
                          </strong>
                          <button
                            className="icon-button danger"
                            aria-label={`Remove keyframe ${index + 1}`}
                            disabled={selected.keyframes!.length <= 1}
                            onClick={() =>
                              updateTrack(selected.id, (track) => {
                                track.keyframes!.splice(index, 1);
                              })
                            }
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <NumberField
                          label={`Keyframe ${index + 1} time`}
                          value={frame.time}
                          min={0}
                          max={duration}
                          step={1 / project.timeline.fps}
                          onChange={(value) =>
                            updateTrack(selected.id, (track) => {
                              track.keyframes![index].time = value;
                              track.keyframes!.sort((a, b) => a.time - b.time);
                            })
                          }
                        />
                        <ValueInput
                          label={`Keyframe ${index + 1} value`}
                          value={frame.value}
                          onChange={(value) =>
                            updateTrack(selected.id, (track) => {
                              track.keyframes![index].value = value;
                            })
                          }
                        />
                        <SelectField
                          label={`Keyframe ${index + 1} easing`}
                          value={frame.easing ?? "linear"}
                          onChange={(value) =>
                            updateTrack(selected.id, (track) => {
                              track.keyframes![index].easing = value;
                            })
                          }
                        >
                          {easings.map((value) => (
                            <option key={value}>{value}</option>
                          ))}
                        </SelectField>
                      </div>
                    ))}
                    <button
                      className="button secondary full"
                      onClick={() => {
                        const at =
                          Math.round(vm.time * project.timeline.fps) /
                          project.timeline.fps;
                        if (
                          selected.keyframes!.some(
                            (frame) => Math.abs(frame.time - at) < 1e-6,
                          )
                        ) {
                          vm.setToast(
                            "There is already a keyframe at the playhead.",
                          );
                          return;
                        }
                        updateTrack(selected.id, (track) => {
                          track.keyframes!.push({
                            time: at,
                            value: structuredClone(
                              track.keyframes![track.keyframes!.length - 1]
                                .value,
                            ),
                          });
                          track.keyframes!.sort((a, b) => a.time - b.time);
                        });
                      }}
                    >
                      <Plus size={14} />
                      Keyframe at playhead
                    </button>
                  </>
                )}
                <div className="field-row">
                  <SelectField
                    label="Before animation"
                    value={selected.before ?? "holdFirst"}
                    onChange={(value) =>
                      updateTrack(selected.id, (track) => {
                        track.before = value;
                      })
                    }
                  >
                    <option value="holdFirst">Hold first value</option>
                    <option value="base">Base value</option>
                  </SelectField>
                  <SelectField
                    label="After animation"
                    value={selected.after ?? "holdLast"}
                    onChange={(value) =>
                      updateTrack(selected.id, (track) => {
                        track.after = value;
                      })
                    }
                  >
                    <option value="holdLast">Hold last value</option>
                    <option value="base">Base value</option>
                  </SelectField>
                </div>
                <button
                  className="button danger subtle full"
                  onClick={() => {
                    vm.edit((documents) => {
                      const current = timelineDoc(documents);
                      current.tracks = current.tracks?.filter(
                        (track) => track.id !== selected.id,
                      );
                    });
                    setSelectedId("");
                  }}
                >
                  <Trash2 size={14} />
                  Remove animation
                </button>
              </Section>
            </>
          ) : (
            <Empty
              title="Select an animation"
              detail="Choose a track or add an animation to an element."
            />
          )}
        </div>
      </aside>
      {modal && (
        <Modal title="Add an animation" onClose={() => setModal(false)}>
          <SelectField
            label="Animate element"
            value={
              newTarget ||
              targets.find((target) =>
                target.value.endsWith(`/${vm.elementId}`),
              )?.value ||
              targets[0]?.value ||
              ""
            }
            onChange={setNewTarget}
          >
            {targets.map((target) => (
              <option key={target.value} value={target.value}>
                {target.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Animation preset"
            value={preset}
            onChange={setPreset}
          >
            {presets.map((value) => (
              <option key={value}>{value}</option>
            ))}
            <option value="keyframes">Property keyframes</option>
          </SelectField>
          <p className="field-note">
            Starts at the playhead. Fine-tune timing and values in the
            properties panel.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setModal(false)}
            >
              Cancel
            </button>
            <button
              className="button primary"
              disabled={
                !targets.length || (preset === "followPath" && !paths.length)
              }
              onClick={makeTrack}
            >
              <Plus size={15} />
              Add animation
            </button>
          </div>
          {preset === "followPath" && !paths.length && (
            <p className="inline-error">Create a route in Paths first.</p>
          )}
        </Modal>
      )}
    </div>
  );
}
