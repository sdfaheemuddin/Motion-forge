import { useState } from "react";
import { Plus, Palette, Type as TypeIcon } from "lucide-react";
import { useBuilder } from "../viewmodels/BuilderContext";
import {
  assetDoc,
  brandingDoc,
  ensureBranding,
  sceneEntries,
  flatten,
  uniqueId,
} from "../viewmodels/projectModel";
import {
  PageHeading,
  Empty,
  ColorField,
  TextField,
  NumberField,
  SelectField,
  Section,
} from "../components/Fields";

export function BrandingView() {
  const vm = useBuilder(),
    [newColor, setNewColor] = useState("accent"),
    [selectedStyle, setSelectedStyle] = useState("");
  if (!vm.bundle)
    return (
      <Empty
        title="A consistent visual identity"
        detail="Open a project to set up its branding."
      />
    );
  const bundle = vm.bundle,
    brand = brandingDoc(bundle.documents),
    assets = assetDoc(bundle.documents).assets,
    styles = Object.entries(brand.textStyles ?? {}),
    selected = selectedStyle || styles[0]?.[0];
  const style = brand.textStyles?.[selected];
  return (
    <div className="page-scroll">
      <PageHeading
        title="Make it unmistakably yours"
        subtitle="A shared palette, typography, and logo for every scene."
      />
      <div className="branding-grid">
        <div className="card">
          <Section title="Project logo">
            <div className="brand-logo-preview checker">
              {brand.logo && bundle.assetMetadata[brand.logo]?.url ? (
                <img
                  src={bundle.assetMetadata[brand.logo].url}
                  alt="Project logo"
                />
              ) : (
                <span className="muted">Choose a logo from your assets</span>
              )}
            </div>
            <SelectField
              label="Logo asset"
              value={brand.logo ?? ""}
              onChange={(value) =>
                vm.edit((documents) => {
                  const branding = ensureBranding(documents),
                    old = branding.logo;
                  branding.logo = value;
                  if (old && value)
                    for (const { scene } of sceneEntries(documents))
                      for (const element of flatten(scene.elements))
                        if (element.type === "image" && element.asset === old)
                          element.asset = value;
                })
              }
            >
              <option value="">No logo selected</option>
              {assets
                .filter((asset) => asset.type === "image")
                .map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.id}
                  </option>
                ))}
            </SelectField>
            <p className="field-note">
              Changing the logo updates image elements that use the previous
              logo asset.
            </p>
          </Section>
        </div>
        <div className="card">
          <Section title="Colour palette" action={<Palette size={16} />}>
            {Object.entries(brand.colors ?? {}).map(([name, value]) => (
              <ColorField
                key={name}
                label={name}
                value={value}
                onChange={(color) =>
                  vm.edit((documents) => {
                    const branding = ensureBranding(documents);
                    (branding.colors ??= {})[name] = color;
                  })
                }
              />
            ))}
            <div className="inline-add">
              <input
                aria-label="New colour name"
                value={newColor}
                onChange={(event) => setNewColor(event.target.value)}
                placeholder="Colour name"
              />
              <button
                aria-label="Add colour"
                className="button secondary"
                onClick={() => {
                  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(newColor)) {
                    vm.setToast(
                      "Use letters, numbers, hyphens or underscores for a colour name.",
                    );
                    return;
                  }
                  vm.edit((documents) => {
                    const branding = ensureBranding(documents);
                    (branding.colors ??= {})[newColor] ??= "#51D6C3";
                  });
                }}
              >
                <Plus size={16} />
              </button>
            </div>
          </Section>
        </div>
        <div className="card typography-card">
          <Section
            title="Text styles"
            action={
              <button
                className="button text"
                onClick={() => {
                  const name = uniqueId(
                    "style",
                    Object.keys(brand.textStyles ?? {}),
                  );
                  vm.edit((documents) => {
                    const branding = ensureBranding(documents);
                    (branding.textStyles ??= {})[name] = {
                      size: 48,
                      color: "#FFFFFF",
                      align: "left",
                    };
                  });
                  setSelectedStyle(name);
                }}
              >
                <Plus size={14} />
                New style
              </button>
            }
          >
            <div className="typography-layout">
              <div className="style-list">
                {styles.map(([name, value]) => (
                  <button
                    className={selected === name ? "selected" : ""}
                    key={name}
                    onClick={() => setSelectedStyle(name)}
                  >
                    <TypeIcon size={17} />
                    <span>
                      <strong>{name}</strong>
                      <small>
                        {value.size ?? 48}px · {value.font ?? "Default font"}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
              <div className="style-editor">
                {style ? (
                  <>
                    <div
                      className="text-style-sample"
                      style={{
                        color: style.color?.startsWith("$")
                          ? brand.colors?.[style.color.slice(8)]
                          : style.color,
                        fontSize: Math.min(style.size ?? 48, 60),
                        textAlign: style.align,
                      }}
                    >
                      Every frame tells a story.
                    </div>
                    <div className="settings-grid">
                      <SelectField
                        label="Style font"
                        value={style.font ?? ""}
                        onChange={(value) =>
                          vm.edit((documents) => {
                            const current =
                              ensureBranding(documents).textStyles![selected];
                            if (value) current.font = value;
                            else delete current.font;
                          })
                        }
                      >
                        <option value="">Default system font</option>
                        {assets
                          .filter((asset) => asset.type === "font")
                          .map((asset) => (
                            <option key={asset.id} value={asset.id}>
                              {asset.id}
                            </option>
                          ))}
                      </SelectField>
                      <NumberField
                        label="Style font size"
                        value={style.size ?? 48}
                        min={1}
                        onChange={(value) =>
                          vm.edit((documents) => {
                            ensureBranding(documents).textStyles![
                              selected
                            ].size = value;
                          })
                        }
                      />
                      <ColorField
                        label="Style colour"
                        value={style.color ?? "#FFFFFF"}
                        onChange={(value) =>
                          vm.edit((documents) => {
                            ensureBranding(documents).textStyles![
                              selected
                            ].color = value;
                          })
                        }
                      />
                      <SelectField
                        label="Style alignment"
                        value={style.align ?? "left"}
                        onChange={(value) =>
                          vm.edit((documents) => {
                            ensureBranding(documents).textStyles![
                              selected
                            ].align = value as "left" | "center" | "right";
                          })
                        }
                      >
                        {["left", "center", "right"].map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </SelectField>
                    </div>
                    <p className="field-note">
                      Styles apply to text elements that reference them.
                      Element-specific settings override the style.
                    </p>
                  </>
                ) : (
                  <Empty
                    title="Define your typography"
                    detail="Add a text style to reuse it across scenes."
                  />
                )}
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
