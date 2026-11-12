import { Plus, Trash2, SlidersHorizontal, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useBuilder } from "../viewmodels/BuilderContext";
import {
  assetDoc,
  brandingDoc,
  timelineDoc,
  sceneEntries,
  flatten,
  uniqueId,
  elementById,
} from "../viewmodels/projectModel";
import {
  Section,
  NumberField,
  TextField,
  SelectField,
  ColorField,
  Empty,
} from "./Fields";
import type { Effect, VideoElement, Vec2 } from "../models/types";

export function ElementInspector() {
  const vm = useBuilder(),
    [effectType, setEffectType] = useState("glow");
  if (!vm.bundle || !vm.selected)
    return (
      <aside className="inspector">
        <div className="panel-heading">
          <SlidersHorizontal size={15} />
          <h2>Properties</h2>
        </div>
        <Empty
          title="Select an element"
          detail="Choose a layer or click an element on the canvas."
        />
      </aside>
    );
  const element = vm.selected,
    docs = vm.bundle.documents,
    assets = assetDoc(docs).assets,
    branding = brandingDoc(docs),
    style = branding.textStyles?.[element.style ?? ""];
  const clip = timelineDoc(docs).clips.find(
      (clip) => clip.scene === vm.sceneId,
    ),
    transform = element.transform ?? {},
    metadata = vm.bundle.assetMetadata[element.asset ?? ""];
  const write = (update: (element: VideoElement) => void) =>
    vm.updateElement(element.id, update);
  const transformValue = (
    key: "position" | "scale" | "anchor",
    axis: number,
    value: number,
  ) =>
    write((item) => {
      const vector = [
        ...(item.transform?.[key] ?? (key === "scale" ? [1, 1] : [0, 0])),
      ] as Vec2;
      vector[axis] = value;
      item.transform = { ...item.transform, [key]: vector };
    });
  const animatedPosition = (timelineDoc(docs).tracks ?? []).some(
    (track) =>
      track.target === `${clip?.id}/${element.id}` &&
      (track.property === "position" ||
        ["followPath", "slideIn"].includes(track.animation ?? "")),
  );
  const width =
    element.width ??
    (element.height && metadata?.width && metadata.height
      ? (element.height * metadata.width) / metadata.height
      : (metadata?.width ?? vm.project!.canvas.width));
  const height =
    element.height ??
    (element.width && metadata?.width && metadata.height
      ? (element.width * metadata.height) / metadata.width
      : (metadata?.height ?? vm.project!.canvas.height));
  const effectWrite = (index: number, update: (effect: Effect) => void) =>
    write((item) => {
      if (item.effects?.[index]) update(item.effects[index]);
    });
  return (
    <aside className="inspector">
      <div className="panel-heading">
        <SlidersHorizontal size={15} />
        <h2>Properties</h2>
        <span className="pill">{element.type}</span>
      </div>
      <div className="inspector-scroll">
        <div className="element-identity">
          <strong>{element.id}</strong>
          <span>{element.type.toUpperCase()} ELEMENT</span>
        </div>
        {element.type === "text" && (
          <Section title="Text">
            <label className="field-label" htmlFor="element-text">
              Content
            </label>
            <textarea
              id="element-text"
              value={element.text ?? ""}
              rows={3}
              onChange={(event) =>
                write((item) => {
                  item.text = event.target.value;
                })
              }
            />
            <SelectField
              label="Text style"
              value={element.style ?? ""}
              onChange={(value) =>
                write((item) => {
                  if (value) {
                    item.style = value;
                    delete item.font;
                    delete item.size;
                    delete item.color;
                    delete item.align;
                  } else delete item.style;
                })
              }
            >
              <option value="">Custom text</option>
              {Object.keys(branding.textStyles ?? {}).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </SelectField>
            <SelectField
              label="Font"
              value={element.font ?? ""}
              onChange={(value) =>
                write((item) => {
                  if (value) item.font = value;
                  else delete item.font;
                })
              }
            >
              <option value="">Inherit / system font</option>
              {assets
                .filter((asset) => asset.type === "font")
                .map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.id}
                  </option>
                ))}
            </SelectField>
            <div className="field-row">
              <NumberField
                label="Font size"
                value={element.size ?? style?.size ?? 48}
                min={1}
                onChange={(value) =>
                  write((item) => {
                    item.size = value;
                  })
                }
              />
              <SelectField
                label="Alignment"
                value={element.align ?? style?.align ?? "left"}
                onChange={(value) =>
                  write((item) => {
                    item.align = value as "left" | "center" | "right";
                  })
                }
              >
                {["left", "center", "right"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </SelectField>
            </div>
            <ColorField
              label="Text colour"
              value={element.color ?? style?.color ?? "#FFFFFF"}
              onChange={(value) =>
                write((item) => {
                  item.color = value;
                })
              }
            />
          </Section>
        )}
        {["image", "video"].includes(element.type) && (
          <Section title={element.type === "image" ? "Image" : "Video"}>
            <SelectField
              label="Source asset"
              value={element.asset ?? ""}
              onChange={(value) =>
                write((item) => {
                  item.asset = value;
                })
              }
            >
              {assets
                .filter((asset) => asset.type === element.type)
                .map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.id}
                  </option>
                ))}
            </SelectField>
            <div className="field-row">
              <NumberField
                label="Width"
                value={width}
                min={1}
                onChange={(value) =>
                  write((item) => {
                    item.width = value;
                  })
                }
              />
              <NumberField
                label="Height"
                value={height}
                min={1}
                onChange={(value) =>
                  write((item) => {
                    item.height = value;
                  })
                }
              />
            </div>
            <SelectField
              label="Image fit"
              value={element.fit ?? "contain"}
              onChange={(value) =>
                write((item) => {
                  item.fit = value;
                })
              }
            >
              {["contain", "cover", "stretch"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </SelectField>
            {element.type === "video" && (
              <div className="field-row">
                <NumberField
                  label="Trim start (s)"
                  value={element.trimStart ?? 0}
                  min={0}
                  step={0.1}
                  onChange={(value) =>
                    write((item) => {
                      item.trimStart = value;
                    })
                  }
                />
                <NumberField
                  label="Playback speed"
                  value={element.playbackSpeed ?? 1}
                  min={0.1}
                  step={0.1}
                  onChange={(value) =>
                    write((item) => {
                      item.playbackSpeed = value;
                    })
                  }
                />
              </div>
            )}
          </Section>
        )}
        {element.type === "shape" && (
          <Section title="Shape">
            <SelectField
              label="Shape type"
              value={element.shape ?? "rectangle"}
              onChange={(value) =>
                write((item) => {
                  item.shape = value;
                  if (value === "circle") {
                    delete item.width;
                    delete item.height;
                    item.radius ??= 36;
                  }
                })
              }
            >
              {["rectangle", "circle", "ellipse"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </SelectField>
            {element.shape === "circle" ? (
              <NumberField
                label="Radius"
                value={element.radius ?? 20}
                min={1}
                onChange={(value) =>
                  write((item) => {
                    item.radius = value;
                  })
                }
              />
            ) : (
              <div className="field-row">
                <NumberField
                  label="Shape width"
                  value={element.width ?? 100}
                  min={1}
                  onChange={(value) =>
                    write((item) => {
                      item.width = value;
                    })
                  }
                />
                <NumberField
                  label="Shape height"
                  value={element.height ?? 100}
                  min={1}
                  onChange={(value) =>
                    write((item) => {
                      item.height = value;
                    })
                  }
                />
              </div>
            )}
            <ColorField
              label="Fill colour"
              value={element.fill ?? "#FFFFFF"}
              onChange={(value) =>
                write((item) => {
                  item.fill = value;
                })
              }
            />
            {element.shape === "rectangle" && (
              <NumberField
                label="Corner radius"
                value={element.cornerRadius ?? 0}
                min={0}
                onChange={(value) =>
                  write((item) => {
                    item.cornerRadius = value;
                  })
                }
              />
            )}
          </Section>
        )}
        {element.type === "path" && (
          <Section title="Path">
            <SelectField
              label="Shared route"
              value={element.path ?? ""}
              onChange={(value) =>
                write((item) => {
                  if (value) {
                    item.path = value;
                    delete item.points;
                    delete item.segments;
                    delete item.asset;
                  } else delete item.path;
                })
              }
            >
              <option value="">Inline / asset geometry</option>
              {(timelineDoc(docs).paths ?? []).map((path) => (
                <option key={path.id} value={path.id}>
                  {path.id}
                </option>
              ))}
            </SelectField>
            <ColorField
              label="Line colour"
              value={element.stroke ?? "#FFFFFF"}
              onChange={(value) =>
                write((item) => {
                  item.stroke = value;
                })
              }
            />
            <NumberField
              label="Line width"
              value={element.strokeWidth ?? 2}
              min={0}
              onChange={(value) =>
                write((item) => {
                  item.strokeWidth = value;
                })
              }
            />
            <button
              className="button secondary full"
              onClick={() => vm.setTab("timeline")}
            >
              Edit routes in Timeline
              <ChevronRight size={14} />
            </button>
          </Section>
        )}
        {element.type === "group" && (
          <Section title="Group">
            <p className="muted">
              {element.children?.length ?? 0} child elements. Children use local
              coordinates.
            </p>
            <button
              className="button secondary full"
              onClick={() => {
                const ids = sceneEntries(docs).flatMap((item) =>
                  flatten(item.scene.elements).map((element) => element.id),
                );
                const id = uniqueId("group-text", ids);
                write((item) => {
                  (item.children ??= []).push({
                    id,
                    type: "text",
                    text: "Your message",
                    size: 48,
                    transform: { position: [40, 40] },
                  });
                });
              }}
            >
              <Plus size={14} />
              Add text to group
            </button>
          </Section>
        )}
        <Section title="Transform">
          <div className="field-row">
            <NumberField
              label="Position X"
              value={transform.position?.[0] ?? 0}
              onChange={(value) => transformValue("position", 0, value)}
              disabled={animatedPosition}
            />
            <NumberField
              label="Position Y"
              value={transform.position?.[1] ?? 0}
              onChange={(value) => transformValue("position", 1, value)}
              disabled={animatedPosition}
            />
          </div>
          {animatedPosition && (
            <button
              className="inline-link"
              onClick={() => vm.setTab("timeline")}
            >
              Position is controlled by an animation →
            </button>
          )}
          <div className="field-row">
            <NumberField
              label="Scale X"
              value={transform.scale?.[0] ?? 1}
              step={0.05}
              onChange={(value) => transformValue("scale", 0, value)}
            />
            <NumberField
              label="Scale Y"
              value={transform.scale?.[1] ?? 1}
              step={0.05}
              onChange={(value) => transformValue("scale", 1, value)}
            />
          </div>
          <div className="field-row">
            <NumberField
              label="Rotation (°)"
              value={transform.rotation ?? 0}
              onChange={(value) =>
                write((item) => {
                  item.transform = { ...item.transform, rotation: value };
                })
              }
            />
            <NumberField
              label="Opacity"
              value={transform.opacity ?? 1}
              min={0}
              max={1}
              step={0.05}
              onChange={(value) =>
                write((item) => {
                  item.transform = { ...item.transform, opacity: value };
                })
              }
            />
          </div>
          <div className="field-row">
            <NumberField
              label="Anchor X"
              value={transform.anchor?.[0] ?? 0}
              step={0.1}
              onChange={(value) => transformValue("anchor", 0, value)}
            />
            <NumberField
              label="Anchor Y"
              value={transform.anchor?.[1] ?? 0}
              step={0.1}
              onChange={(value) => transformValue("anchor", 1, value)}
            />
          </div>
          <NumberField
            label="Layer order"
            value={element.layer ?? 0}
            onChange={(value) =>
              write((item) => {
                item.layer = value;
              })
            }
          />
        </Section>
        <Section title="Visibility">
          <div className="field-row">
            <NumberField
              label="Visible from (s)"
              value={element.visibility?.start ?? clip?.start ?? 0}
              min={0}
              step={0.1}
              onChange={(value) =>
                write((item) => {
                  item.visibility = { ...item.visibility, start: value };
                })
              }
            />
            <NumberField
              label="Visible until (s)"
              value={
                element.visibility?.end ??
                (clip
                  ? clip.start + clip.duration
                  : vm.project!.timeline.duration)
              }
              min={0}
              step={0.1}
              onChange={(value) =>
                write((item) => {
                  item.visibility = { ...item.visibility, end: value };
                })
              }
            />
          </div>
        </Section>
        <Section title="Effects">
          <div className="inline-add">
            <select
              aria-label="Effect to add"
              value={effectType}
              onChange={(event) => setEffectType(event.target.value)}
            >
              {["glow", "shadow", "blur", "trail"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <button
              className="button secondary"
              aria-label="Add effect"
              onClick={() =>
                write((item) => {
                  (item.effects ??= []).push(
                    effectType === "trail"
                      ? {
                          type: effectType,
                          duration: 0.4,
                          samples: 6,
                          intensity: 0.5,
                        }
                      : effectType === "blur"
                        ? { type: effectType, radius: 4 }
                        : {
                            type: effectType,
                            radius: 16,
                            intensity: 0.8,
                            color:
                              effectType === "shadow" ? "#000000" : "#51D6C3",
                          },
                  );
                })
              }
            >
              <Plus size={16} />
            </button>
          </div>
          {element.effects?.map((effect, index) => (
            <div className="effect-card" key={index}>
              <div className="effect-heading">
                <strong>{effect.type}</strong>
                <button
                  className="icon-button danger"
                  aria-label={`Remove ${effect.type} effect ${index + 1}`}
                  onClick={() =>
                    vm.edit((documents) => {
                      const current = elementById(
                        documents,
                        vm.sceneId,
                        element.id,
                      )!;
                      current.effects!.splice(index, 1);
                      const timeline = timelineDoc(documents),
                        clips = timeline.clips
                          .filter((clip) => clip.scene === vm.sceneId)
                          .map((clip) => clip.id);
                      timeline.tracks = (timeline.tracks ?? []).filter(
                        (track) => {
                          if (
                            !clips.some(
                              (clip) =>
                                track.target === `${clip}/${element.id}`,
                            ) ||
                            !track.property?.startsWith("effects.")
                          )
                            return true;
                          const parts = track.property.split("."),
                            n = +parts[1];
                          if (n === index) return false;
                          if (n > index)
                            track.property = `effects.${n - 1}.${parts[2]}`;
                          return true;
                        },
                      );
                    })
                  }
                >
                  <Trash2 size={13} />
                </button>
              </div>
              {["glow", "shadow"].includes(effect.type) && (
                <ColorField
                  label={`Effect ${index + 1} colour`}
                  value={effect.color ?? "#51D6C3"}
                  onChange={(value) =>
                    effectWrite(index, (item) => {
                      item.color = value;
                    })
                  }
                />
              )}
              <div className="field-row">
                {effect.type === "trail" ? (
                  <NumberField
                    label="Trail duration"
                    value={effect.duration ?? 0.4}
                    min={0.01}
                    step={0.05}
                    onChange={(value) =>
                      effectWrite(index, (item) => {
                        item.duration = value;
                      })
                    }
                  />
                ) : (
                  <NumberField
                    label="Effect radius"
                    value={effect.radius ?? 12}
                    min={0}
                    onChange={(value) =>
                      effectWrite(index, (item) => {
                        item.radius = value;
                      })
                    }
                  />
                )}
                {effect.type !== "blur" && (
                  <NumberField
                    label="Effect intensity"
                    value={effect.intensity ?? 0.8}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(value) =>
                      effectWrite(index, (item) => {
                        item.intensity = value;
                      })
                    }
                  />
                )}
              </div>
              {effect.type === "trail" && (
                <NumberField
                  label="Trail samples"
                  value={effect.samples ?? 6}
                  min={2}
                  max={64}
                  onChange={(value) =>
                    effectWrite(index, (item) => {
                      item.samples = value;
                    })
                  }
                />
              )}
            </div>
          ))}
        </Section>
      </div>
    </aside>
  );
}
