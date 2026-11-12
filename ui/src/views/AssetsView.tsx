import { useRef, useState } from "react";
import {
  UploadCloud,
  Search,
  Image as ImageIcon,
  Film,
  Music2,
  Type,
  Route,
  Plus,
  Trash2,
  File,
  Check,
} from "lucide-react";
import { useBuilder } from "../viewmodels/BuilderContext";
import { assetDoc, assetUsage } from "../viewmodels/projectModel";
import { PageHeading, Empty, Section } from "../components/Fields";
import type { Asset } from "../models/types";

const icons = {
  image: ImageIcon,
  video: Film,
  audio: Music2,
  font: Type,
  path: Route,
};
export function AssetsView() {
  const vm = useBuilder(),
    input = useRef<HTMLInputElement>(null),
    [query, setQuery] = useState(""),
    [type, setType] = useState("all"),
    [selected, setSelected] = useState(""),
    [dragging, setDragging] = useState(false);
  if (!vm.bundle)
    return (
      <Empty
        title="Your asset library"
        detail="Open or create a project to import assets."
      />
    );
  const bundle = vm.bundle,
    assets = assetDoc(bundle.documents).assets,
    shown = assets.filter(
      (asset) =>
        (type === "all" || asset.type === type) &&
        `${asset.id} ${asset.source}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  const asset = assets.find((item) => item.id === selected),
    metadata = asset ? bundle.assetMetadata[asset.id] : undefined,
    usage = asset ? assetUsage(bundle.documents, asset.id) : [];
  const add = (value: Asset) => {
    if (["image", "video", "path"].includes(value.type))
      vm.add(value.type, value);
    else
      vm.setToast(
        value.type === "font"
          ? "Choose this font in Branding or a text element’s properties."
          : "Add this audio asset from Timeline → Audio.",
      );
  };
  return (
    <div className="page-scroll">
      <PageHeading
        title="Asset library"
        subtitle="Everything your story is made of, in one place."
      >
        <button
          className="button primary"
          onClick={() => input.current?.click()}
          disabled={!!vm.busy}
        >
          <UploadCloud size={17} />
          Import assets
        </button>
        <input
          ref={input}
          aria-label="Import asset files"
          className="visually-hidden"
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.webp,.gif,.ttf,.otf,.wav,.mp3,.aac,.ogg,.flac,.m4a,.mp4,.mov,.mkv,.webm,.json"
          onChange={(event) => {
            if (event.target.files) void vm.upload(event.target.files);
            event.target.value = "";
          }}
        />
      </PageHeading>
      <div
        className={`drop-zone ${dragging ? "dragging" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void vm.upload(event.dataTransfer.files);
        }}
      >
        <UploadCloud size={25} />
        <div>
          <strong>Drop files to bring them into your project</strong>
          <p>
            Images, video, audio, fonts, or path JSON · up to 100 MB per file
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => input.current?.click()}
        >
          Browse files
        </button>
      </div>
      <div className="asset-workspace">
        <div className="asset-main">
          <div className="asset-filterbar">
            <div className="segmented">
              {["all", "image", "video", "audio", "font", "path"].map(
                (value) => (
                  <button
                    className={type === value ? "selected" : ""}
                    key={value}
                    onClick={() => setType(value)}
                  >
                    {value === "all"
                      ? "All assets"
                      : `${value[0].toUpperCase()}${value.slice(1)}s`}
                  </button>
                ),
              )}
            </div>
            <div className="search-input">
              <Search size={15} />
              <input
                aria-label="Search assets"
                placeholder="Find an asset…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
          <div className="asset-grid">
            {shown.map((value) => {
              const Icon = icons[value.type] ?? File,
                meta = bundle.assetMetadata[value.id];
              return (
                <button
                  key={value.id}
                  className={`asset-card ${selected === value.id ? "selected" : ""}`}
                  onClick={() => setSelected(value.id)}
                >
                  <div className="asset-card-art checker">
                    {value.type === "image" && meta?.url ? (
                      <img src={meta.url} alt={value.id} />
                    ) : (
                      <Icon size={33} />
                    )}
                    <span className="asset-type">{value.type}</span>
                    {selected === value.id && (
                      <span className="asset-check">
                        <Check size={13} />
                      </span>
                    )}
                  </div>
                  <strong>{value.id}</strong>
                  <small>
                    {meta?.width
                      ? `${meta.width} × ${meta.height}`
                      : value.source.startsWith("system:")
                        ? "System font"
                        : meta?.bytes
                          ? `${Math.round(meta.bytes / 1024)} KB`
                          : value.type}
                  </small>
                </button>
              );
            })}
          </div>
          {!shown.length && (
            <Empty
              title="No assets here yet"
              detail="Import a file or try another filter."
            />
          )}
        </div>
        <aside className="asset-details card">
          {asset ? (
            <>
              <Section title="Asset details">
                <div className="asset-large-preview checker">
                  {asset.type === "image" && metadata?.url ? (
                    <img src={metadata.url} alt={asset.id} />
                  ) : asset.type === "video" && metadata?.url ? (
                    <video src={metadata.url} controls />
                  ) : asset.type === "audio" && metadata?.url ? (
                    <audio src={metadata.url} controls />
                  ) : (
                    <File size={40} />
                  )}
                </div>
                <h3 className="asset-detail-name">{asset.id}</h3>
                <p className="break-word muted">{asset.source}</p>
                {metadata?.error && (
                  <p className="inline-error">{metadata.error}</p>
                )}
                <button
                  className="button primary full"
                  onClick={() => add(asset)}
                >
                  <Plus size={15} />
                  {["image", "video", "path"].includes(asset.type)
                    ? "Add to scene"
                    : asset.type === "font"
                      ? "Use font"
                      : "Use audio"}
                </button>
              </Section>
              <Section
                title={`Used in ${usage.length} place${usage.length === 1 ? "" : "s"}`}
              >
                {usage.length ? (
                  <ul className="usage-list">
                    {usage.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Not used in this project yet.</p>
                )}
                <button
                  className="button danger subtle full"
                  disabled={usage.length > 0}
                  onClick={() => {
                    vm.edit((documents) => {
                      const entry = assetDoc(documents);
                      entry.assets = entry.assets.filter(
                        (item) => item.id !== asset.id,
                      );
                    });
                    setSelected("");
                  }}
                >
                  <Trash2 size={14} />
                  Remove from project
                </button>
                <small>
                  Referenced assets cannot be removed. Imported files stay on
                  disk.
                </small>
              </Section>
            </>
          ) : (
            <Empty
              title="Select an asset"
              detail="Inspect a file and add it to the scene."
            />
          )}
        </aside>
      </div>
    </div>
  );
}
