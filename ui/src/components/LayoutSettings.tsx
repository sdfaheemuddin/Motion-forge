import { Plus, Trash2 } from "lucide-react";
import { useBuilder } from "../viewmodels/BuilderContext";
import { layouts, bindings } from "../viewmodels/presentationModel";
import { uniqueId, assetDoc, timelineDoc } from "../viewmodels/projectModel";
import {
  Section,
  NumberField,
  TextField,
  ColorField,
  SelectField,
  Toggle,
} from "./Fields";
import type { LayoutDesign } from "../models/types";
export function LayoutSettings() {
  const vm = useBuilder();
  if (!vm.bundle) return null;
  const entry = layouts(vm.bundle.documents).find(
      (x) => x.design.id === vm.sceneId,
    ),
    layout = entry?.design;
  const update = (change: (layout: LayoutDesign) => void) =>
    vm.edit((d) => change(d[entry!.file] as LayoutDesign));
  if (!layout)
    return (
      <div className="composition-note">
        Shared content uses the project clock. Add images, paths, and animation
        here; scenes pan and zoom the same composition.
      </div>
    );
  return (
    <div className="layout-settings">
      <Section title="Layout design">
        <TextField
          label="Layout name"
          value={layout.name}
          onChange={(v) =>
            update((x) => {
              x.name = v;
            })
          }
        />
        <p className="field-note">
          Select a text or image layer and set its content key to make it
          editable in Scenes. Unbound layers stay fixed.
        </p>
        {vm.selected &&
          ["text", "image", "video"].includes(vm.selected.type) && (
            <TextField
              label="Scene content key"
              value={vm.selected.binding ?? ""}
              placeholder="title, subtitle, logo…"
              onChange={(v) => {
                if (v && !/^[A-Za-z][A-Za-z0-9_-]*$/.test(v)) {
                  vm.setToast(
                    "Use letters, numbers, underscores or hyphens for content keys.",
                  );
                  return;
                }
                vm.updateElement(vm.elementId, (e) => {
                  if (v) e.binding = v;
                  else delete e.binding;
                });
              }}
            />
          )}
      </Section>
      <Section title="Content viewport">
        <div className="field-row">
          {(["x", "y", "width", "height"] as const).map((key) => (
            <NumberField
              key={key}
              label={`Viewport ${key}`}
              value={layout.viewport[key]}
              min={key === "width" || key === "height" ? 1 : 0}
              onChange={(v) =>
                update((x) => {
                  x.viewport[key] = v;
                })
              }
            />
          ))}
        </div>
      </Section>
      <Section
        title="Navigation labels"
        action={
          <button
            className="icon-button"
            aria-label="Add navigation item"
            onClick={() =>
              update((x) => {
                const nav = (x.navigation ??= { items: [] });
                nav.items.push({
                  id: uniqueId(
                    "item",
                    nav.items.map((i) => i.id),
                  ),
                  label: "NEW LABEL",
                });
              })
            }
          >
            <Plus size={14} />
          </button>
        }
      >
        {(layout.navigation?.items ?? []).map((item, index) => (
          <div className="nav-item-editor" key={item.id}>
            <TextField
              label={`Navigation ${index + 1} label`}
              value={item.label}
              onChange={(v) =>
                update((x) => {
                  x.navigation!.items[index].label = v;
                })
              }
            />
            <small>{item.id}</small>
            <button
              className="icon-button danger"
              aria-label={`Remove navigation ${item.id}`}
              onClick={() =>
                vm.edit((d) => {
                  (d[entry!.file] as LayoutDesign).navigation!.items.splice(
                    index,
                    1,
                  );
                  for (const file of (d["project.json"] as { scenes: string[] })
                    .scenes) {
                    const s = d[file] as {
                      layout?: string;
                      activeNavigationItem?: string;
                    };
                    if (
                      s.layout === layout.id &&
                      s.activeNavigationItem === item.id
                    )
                      s.activeNavigationItem = "";
                  }
                })
              }
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <div className="field-row">
          {(["x", "y", "width", "size"] as const).map((key) => (
            <NumberField
              key={key}
              label={`Navigation ${key}`}
              value={
                layout.navigation?.[key] ??
                { x: 80, y: 960, width: 1600, size: 18 }[key]
              }
              min={key === "width" || key === "size" ? 1 : 0}
              onChange={(v) =>
                update((x) => {
                  (x.navigation ??= { items: [] })[key] = v;
                })
              }
            />
          ))}
        </div>
        <ColorField
          label="Normal label colour"
          value={layout.navigation?.color ?? "#718595"}
          onChange={(v) =>
            update((x) => {
              (x.navigation ??= { items: [] }).color = v;
            })
          }
        />
        <ColorField
          label="Active label colour"
          value={layout.navigation?.activeColor ?? "#70E1C4"}
          onChange={(v) =>
            update((x) => {
              (x.navigation ??= { items: [] }).activeColor = v;
            })
          }
        />
        <SelectField
          label="Navigation font"
          value={layout.navigation?.font ?? ""}
          onChange={(value) =>
            update((x) => {
              const nav = (x.navigation ??= { items: [] });
              if (value) nav.font = value;
              else delete nav.font;
            })
          }
        >
          <option value="">Default system font</option>
          {assetDoc(vm.bundle.documents)
            .assets.filter((asset) => asset.type === "font")
            .map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.id}
              </option>
            ))}
        </SelectField>
        <Toggle
          label="Underline active labels"
          checked={layout.navigation?.underline ?? true}
          onChange={(v) =>
            update((x) => {
              (x.navigation ??= { items: [] }).underline = v;
            })
          }
        />
      </Section>
    </div>
  );
}
