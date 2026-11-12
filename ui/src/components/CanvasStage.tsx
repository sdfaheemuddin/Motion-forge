import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Maximize2, MousePointer2 } from "lucide-react";
import { useBuilder } from "../viewmodels/BuilderContext";
import {
  brandingDoc,
  sceneEntries,
  timelineDoc,
  flatten,
} from "../viewmodels/projectModel";
import { animatedState, pathPoints } from "../viewmodels/animationModel";
import type { Bundle, Clip, Vec2, VideoElement } from "../models/types";

interface Hit {
  id: string;
  scene: string;
  clip: string;
  width: number;
  height: number;
  matrix: DOMMatrix;
  parent: DOMMatrix;
  corners: DOMPoint[];
  position: Vec2;
  scale: Vec2;
}
const clamp = (n: number, low: number, high: number) =>
  Math.max(low, Math.min(high, n));

export function CanvasStage({
  interactive = true,
  editPathId,
}: {
  interactive?: boolean;
  editPathId?: string;
}) {
  const vm = useBuilder(),
    canvas = useRef<HTMLCanvasElement>(null),
    shell = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ width: 640, height: 360 }),
    [zoom, setZoom] = useState(1),
    [assetsVersion, setAssetsVersion] = useState(0);
  const images = useRef(new Map<string, HTMLImageElement>()),
    videos = useRef(new Map<string, HTMLVideoElement>()),
    fonts = useRef(new Set<string>());
  const hits = useRef<Hit[]>([]),
    drag = useRef<{
      hit?: Hit;
      origin: Vec2;
      start: Vec2;
      mode: "move" | "resize" | "path";
      point?: number;
      scale?: Vec2;
    } | null>(null);
  const bundle = vm.bundle,
    project = vm.project;
  useEffect(() => {
    if (!shell.current || !project) return;
    const observer = new ResizeObserver(([entry]) => {
      const ratio = project.canvas.width / project.canvas.height,
        w = Math.max(200, entry.contentRect.width - 64),
        h = Math.max(160, entry.contentRect.height - 64);
      setFit(
        w / h > ratio
          ? { width: h * ratio, height: h }
          : { width: w, height: w / ratio },
      );
    });
    observer.observe(shell.current);
    return () => observer.disconnect();
  }, [project?.canvas.width, project?.canvas.height]);
  useEffect(() => {
    if (!bundle) return;
    let alive = true;
    const refresh = () => {
      if (alive) setAssetsVersion((value) => value + 1);
    };
    for (const [id, metadata] of Object.entries(bundle.assetMetadata)) {
      if (!metadata.url) continue;
      if (metadata.type === "image") {
        let image = images.current.get(metadata.url);
        if (!image) {
          image = new Image();
          images.current.set(metadata.url, image);
          image.src = metadata.url;
        }
        image.onload = refresh;
      }
      if (metadata.type === "video" && !videos.current.has(metadata.url)) {
        const video = document.createElement("video");
        video.preload = "auto";
        video.muted = true;
        video.src = metadata.url;
        video.onloadeddata = refresh;
        video.onseeked = refresh;
        videos.current.set(metadata.url, video);
      }
      if (metadata.type === "font" && !fonts.current.has(metadata.url)) {
        fonts.current.add(metadata.url);
        const font = new FontFace(`mf-${id}`, `url("${metadata.url}")`);
        font
          .load()
          .then((loaded) => {
            document.fonts.add(loaded);
            refresh();
          })
          .catch(() => undefined);
      }
    }
    return () => {
      alive = false;
    };
  }, [bundle?.assetMetadata]);

  useEffect(() => {
    const el = canvas.current,
      context = el?.getContext("2d");
    if (!el || !context || !bundle || !project) return;
    const ctx = context,
      branding = brandingDoc(bundle.documents),
      timeline = timelineDoc(bundle.documents),
      allHits: Hit[] = [];
    const color = (value: string | undefined, fallback = "#FFFFFF") =>
      value?.startsWith("$colors.")
        ? (branding.colors?.[value.slice(8)] ?? fallback)
        : (value ?? fallback);
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.fillStyle = color(project.canvas.background, "#071421");
    ctx.fillRect(0, 0, el.width, el.height);
    function draw(
      element: VideoElement,
      clip: Clip,
      sceneId: string,
      at: number,
      trail = true,
    ) {
      if (
        at < clip.start ||
        at >= clip.start + clip.duration ||
        at < (element.visibility?.start ?? clip.start) ||
        at >= (element.visibility?.end ?? clip.start + clip.duration)
      )
        return;
      const state = animatedState(element, clip.id, timeline, at),
        transform = state.transform ?? {};
      if ((transform.opacity ?? 1) <= 0) return;
      if (trail)
        for (const effect of state.effects ?? [])
          if (effect.type === "trail") {
            const samples = effect.samples ?? 6;
            for (let index = samples; index > 0; index--) {
              ctx.save();
              ctx.globalAlpha *=
                (effect.intensity ?? 0.5) * (1 - index / (samples + 1));
              draw(
                element,
                clip,
                sceneId,
                at - ((effect.duration ?? 0.4) * index) / samples,
                false,
              );
              ctx.restore();
            }
          }
      ctx.save();
      const parent = ctx.getTransform();
      const position = transform.position ?? [0, 0],
        scale = transform.scale ?? [1, 1],
        anchor = transform.anchor ?? [0, 0];
      ctx.translate(...position);
      ctx.rotate(((transform.rotation ?? 0) * Math.PI) / 180);
      ctx.scale(...scale);
      ctx.globalAlpha *= clamp(transform.opacity ?? 1, 0, 1);
      const style = branding.textStyles?.[state.style ?? ""] ?? {},
        metadata = state.asset ? bundle!.assetMetadata[state.asset] : undefined;
      let width = state.width ?? metadata?.width ?? 100,
        height = state.height ?? metadata?.height ?? 100;
      let image: HTMLImageElement | HTMLVideoElement | undefined;
      if (state.type === "image" && metadata?.url)
        image = images.current.get(metadata.url);
      if (state.type === "video" && metadata?.url) {
        const video = videos.current.get(metadata.url);
        if (video?.readyState && Number.isFinite(video.duration)) {
          const sourceTime =
            (state.trimStart ?? 0) +
            (at - Math.max(clip.start, state.visibility?.start ?? clip.start)) *
              (state.playbackSpeed ?? 1);
          if (!video.seeking && Math.abs(video.currentTime - sourceTime) > 0.06)
            video.currentTime = clamp(
              sourceTime,
              0,
              Math.max(0, video.duration - 0.02),
            );
          image = video;
          width = state.width ?? video.videoWidth;
          height = state.height ?? video.videoHeight;
        }
      }
      if (image) {
        const iw =
            image instanceof HTMLVideoElement
              ? image.videoWidth
              : image.naturalWidth,
          ih =
            image instanceof HTMLVideoElement
              ? image.videoHeight
              : image.naturalHeight;
        if (state.width && !state.height && iw)
          height = (state.width * ih) / iw;
        if (state.height && !state.width && ih)
          width = (state.height * iw) / ih;
      }
      let text = state.text ?? "",
        lines: string[] = [],
        fontSize = state.size ?? style.size ?? 48;
      if (state.type === "text") {
        const fontId = state.font ?? style.font,
          source = bundle!.assetMetadata[fontId ?? ""]?.source;
        const family =
          source?.startsWith("system:") || !fontId
            ? "Arial, sans-serif"
            : `"mf-${fontId}", Arial, sans-serif`;
        ctx.font = `${source?.endsWith("bold") ? 700 : 400} ${fontSize}px ${family}`;
        text = text.slice(0, Math.round(text.length * (state.textReveal ?? 1)));
        for (const paragraph of text.split("\n")) {
          if (!state.width) {
            lines.push(paragraph);
            continue;
          }
          let line = "";
          for (const word of paragraph.split(" ")) {
            const next = `${line} ${word}`.trim();
            if (line && ctx.measureText(next).width > width) {
              lines.push(line);
              line = word;
            } else line = next;
          }
          lines.push(line);
        }
        width =
          state.width ??
          Math.max(1, ...lines.map((line) => ctx.measureText(line).width));
        height =
          state.height ??
          fontSize *
            (state.lineSpacing ?? style.lineSpacing ?? 1.2) *
            Math.max(1, lines.length);
      }
      if (state.type === "shape") {
        width = state.width ?? (state.radius ?? 20) * 2;
        height = state.height ?? (state.radius ?? 20) * 2;
      }
      if (state.type === "group" || state.type === "path") {
        width = state.width ?? project!.canvas.width;
        height = state.height ?? project!.canvas.height;
      }
      ctx.translate(-anchor[0] * width, -anchor[1] * height);
      const matrix = ctx.getTransform();
      if (trail)
        allHits.push({
          id: element.id,
          scene: sceneId,
          clip: clip.id,
          width,
          height,
          matrix,
          parent,
          corners: [
            [0, 0],
            [width, 0],
            [width, height],
            [0, height],
          ].map(([x, y]) => matrix.transformPoint(new DOMPoint(x, y))),
          position,
          scale,
        });
      if (state.reveal !== undefined) {
        ctx.beginPath();
        ctx.rect(0, 0, width * clamp(state.reveal, 0, 1), height);
        ctx.clip();
      }
      for (const effect of state.effects ?? []) {
        if (effect.type === "glow" || effect.type === "shadow") {
          ctx.shadowColor = color(effect.color, "#42E1E6");
          ctx.shadowBlur = (effect.radius ?? 12) * 2;
          ctx.shadowOffsetX =
            effect.type === "shadow" ? (effect.offset?.[0] ?? 6) : 0;
          ctx.shadowOffsetY =
            effect.type === "shadow" ? (effect.offset?.[1] ?? 6) : 0;
        }
        if (effect.type === "blur")
          ctx.filter = `blur(${effect.radius ?? 4}px)`;
      }
      if (
        (state.type === "image" || state.type === "video") &&
        image &&
        (image instanceof HTMLVideoElement
          ? image.readyState >= 2
          : image.complete && image.naturalWidth > 0)
      ) {
        const iw =
            image instanceof HTMLVideoElement
              ? image.videoWidth
              : image.naturalWidth,
          ih =
            image instanceof HTMLVideoElement
              ? image.videoHeight
              : image.naturalHeight;
        if (state.fit === "stretch") ctx.drawImage(image, 0, 0, width, height);
        else {
          const factor =
            state.fit === "cover"
              ? Math.max(width / iw, height / ih)
              : Math.min(width / iw, height / ih);
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, width, height);
          ctx.clip();
          ctx.drawImage(
            image,
            (width - iw * factor) / 2,
            (height - ih * factor) / 2,
            iw * factor,
            ih * factor,
          );
          ctx.restore();
        }
      } else if (state.type === "text") {
        ctx.fillStyle = color(state.color ?? style.color);
        ctx.textBaseline = "top";
        const align = state.align ?? style.align ?? "left";
        ctx.textAlign = align;
        lines.forEach((line, index) =>
          ctx.fillText(
            line,
            align === "left" ? 0 : align === "center" ? width / 2 : width,
            index * fontSize * (state.lineSpacing ?? style.lineSpacing ?? 1.2),
          ),
        );
      } else if (state.type === "shape") {
        ctx.fillStyle = color(state.fill);
        ctx.strokeStyle = color(state.stroke);
        ctx.lineWidth = state.strokeWidth ?? 1;
        ctx.beginPath();
        if (state.shape === "circle" || state.shape === "ellipse")
          ctx.ellipse(
            width / 2,
            height / 2,
            width / 2,
            height / 2,
            0,
            0,
            Math.PI * 2,
          );
        else ctx.roundRect(0, 0, width, height, state.cornerRadius ?? 0);
        ctx.fill();
        if (state.stroke) ctx.stroke();
      } else if (state.type === "path") {
        let segments = state.segments ?? metadata?.pathData?.segments;
        if (!segments) {
          const shared = timeline.paths?.find((path) => path.id === state.path);
          segments = [
            shared
              ? pathPoints(shared)
              : (state.points ?? metadata?.pathData?.points ?? []),
          ];
        }
        ctx.strokeStyle = color(state.stroke);
        ctx.lineWidth = state.strokeWidth ?? 2;
        ctx.lineJoin = "round";
        ctx.beginPath();
        for (const points of segments)
          points.forEach((point, index) =>
            index ? ctx.lineTo(...point) : ctx.moveTo(...point),
          );
        ctx.stroke();
      } else if (state.type === "group") {
        ctx.beginPath();
        ctx.rect(0, 0, width, height);
        ctx.clip();
        for (const child of [...(state.children ?? [])].sort(
          (a, b) => (a.layer ?? 0) - (b.layer ?? 0),
        ))
          draw(child, clip, sceneId, at, trail);
      }
      ctx.restore();
    }
    for (const clip of [...timeline.clips].sort(
      (a, b) => (a.layer ?? 0) - (b.layer ?? 0),
    )) {
      const scene = sceneEntries(bundle.documents).find(
        (item) => item.scene.id === clip.scene,
      )?.scene;
      if (
        scene &&
        clip.start <= vm.time &&
        vm.time < clip.start + clip.duration
      )
        for (const element of [...scene.elements].sort(
          (a, b) => (a.layer ?? 0) - (b.layer ?? 0),
        ))
          draw(element, clip, scene.id, vm.time);
    }
    hits.current = allHits;
    if (interactive) {
      const hit = [...allHits]
        .reverse()
        .find((item) => item.id === vm.elementId && item.scene === vm.sceneId);
      if (hit) {
        ctx.save();
        ctx.strokeStyle = "#70F2DA";
        ctx.lineWidth = Math.max(2, el.width / fit.width);
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        hit.corners.forEach((point, index) =>
          index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y),
        );
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
        const point = hit.corners[2],
          size = Math.max(9, (el.width / fit.width) * 7);
        ctx.fillStyle = "#70F2DA";
        ctx.fillRect(point.x - size / 2, point.y - size / 2, size, size);
        ctx.restore();
      }
      if (editPathId) {
        const path = timeline.paths?.find((item) => item.id === editPathId);
        if (path) {
          ctx.save();
          ctx.strokeStyle = "#FFC479";
          ctx.lineWidth = 3;
          ctx.beginPath();
          path.points.forEach((point, index) =>
            index ? ctx.lineTo(...point) : ctx.moveTo(...point),
          );
          ctx.stroke();
          path.points.forEach((point, index) => {
            ctx.beginPath();
            ctx.arc(...point, (el.width / fit.width) * 6, 0, Math.PI * 2);
            ctx.fillStyle = index ? "#FFC479" : "#70F2DA";
            ctx.fill();
          });
          ctx.restore();
        }
      }
    }
  }, [
    bundle,
    vm.time,
    vm.elementId,
    vm.sceneId,
    assetsVersion,
    interactive,
    editPathId,
    fit.width,
  ]);

  const coordinates = (event: React.PointerEvent): Vec2 => {
    const bounds = canvas.current!.getBoundingClientRect();
    return [
      ((event.clientX - bounds.left) / bounds.width) * project!.canvas.width,
      ((event.clientY - bounds.top) / bounds.height) * project!.canvas.height,
    ];
  };
  const down = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive || !bundle || !project) return;
    const point = coordinates(event),
      tolerance =
        (project.canvas.width / canvas.current!.getBoundingClientRect().width) *
        12;
    if (editPathId) {
      const path = timelineDoc(bundle.documents).paths?.find(
          (path) => path.id === editPathId,
        ),
        index = path?.points.findIndex(
          (p) => Math.hypot(p[0] - point[0], p[1] - point[1]) < tolerance,
        );
      if (index !== undefined && index >= 0) {
        drag.current = {
          origin: point,
          start: point,
          mode: "path",
          point: index,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
    }
    const selected = [...hits.current]
        .reverse()
        .find((hit) => hit.id === vm.elementId && hit.scene === vm.sceneId),
      handle = selected?.corners[2];
    let hit =
      handle && Math.hypot(handle.x - point[0], handle.y - point[1]) < tolerance
        ? selected
        : [...hits.current].reverse().find((item) => {
            try {
              const local = item.matrix
                .inverse()
                .transformPoint(new DOMPoint(...point));
              return (
                local.x >= 0 &&
                local.y >= 0 &&
                local.x <= item.width &&
                local.y <= item.height
              );
            } catch {
              return false;
            }
          });
    if (!hit) {
      vm.setElementId("");
      return;
    }
    if (hit.scene !== vm.sceneId) vm.selectScene(hit.scene);
    vm.setElementId(hit.id);
    const animatedPosition = (timelineDoc(bundle.documents).tracks ?? []).some(
      (track) =>
        track.target === `${hit!.clip}/${hit!.id}` &&
        (track.property === "position" ||
          ["followPath", "slideIn"].includes(track.animation ?? "")),
    );
    const mode =
      handle &&
      hit === selected &&
      Math.hypot(handle.x - point[0], handle.y - point[1]) < tolerance
        ? "resize"
        : "move";
    if (mode === "move" && animatedPosition) {
      vm.setToast(
        "Position is animated. Adjust the track or edit its path in Timeline.",
      );
      return;
    }
    drag.current = {
      hit,
      origin: point,
      start: hit.position,
      mode,
      scale: hit.scale,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const value = drag.current;
    if (!value || !bundle) return;
    const point = coordinates(event);
    if (value.mode === "path") {
      vm.edit((documents) => {
        const path = timelineDoc(documents).paths?.find(
          (path) => path.id === editPathId,
        );
        if (path && value.point !== undefined)
          path.points[value.point] = point.map(Math.round) as Vec2;
      });
      return;
    }
    const hit = value.hit!;
    if (value.mode === "move") {
      const a = hit.parent
          .inverse()
          .transformPoint(new DOMPoint(...value.origin)),
        b = hit.parent.inverse().transformPoint(new DOMPoint(...point));
      vm.updateElement(hit.id, (element) => {
        element.transform = {
          ...element.transform,
          position: [
            Math.round(value.start[0] + b.x - a.x),
            Math.round(value.start[1] + b.y - a.y),
          ],
        };
      });
    } else {
      const local = hit.matrix.inverse().transformPoint(new DOMPoint(...point));
      let x = Math.max(0.02, local.x / hit.width),
        y = Math.max(0.02, local.y / hit.height);
      if (event.shiftKey) x = y = Math.max(x, y);
      vm.updateElement(hit.id, (element) => {
        element.transform = {
          ...element.transform,
          scale: [value.scale![0] * x, value.scale![1] * y],
        };
      });
    }
  };
  if (!project)
    return (
      <div className="canvas-placeholder">
        Open or create a project to start building.
      </div>
    );
  return (
    <div className="canvas-stage">
      <div className="canvas-toolbar">
        <span>
          <MousePointer2 size={14} />
          {interactive ? "Select · drag · resize" : "Visual preview"}
        </span>
        <div className="zoom-controls">
          <button
            aria-label="Zoom out"
            className="icon-button"
            onClick={() => setZoom((value) => Math.max(0.25, value - 0.25))}
          >
            <Minus size={14} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            aria-label="Zoom in"
            className="icon-button"
            onClick={() => setZoom((value) => Math.min(3, value + 0.25))}
          >
            <Plus size={14} />
          </button>
          <button
            aria-label="Fit canvas"
            className="icon-button"
            onClick={() => setZoom(1)}
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>
      <div className="canvas-shell" ref={shell}>
        <div
          className="canvas-artboard"
          style={{ width: fit.width * zoom, height: fit.height * zoom }}
        >
          <canvas
            ref={canvas}
            width={project.canvas.width}
            height={project.canvas.height}
            aria-label="Video canvas"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          />
        </div>
      </div>
      <div className="canvas-footnote">
        <span>
          {project.canvas.width} × {project.canvas.height}
        </span>
        <span>
          Interactive preview · use Engine frame to check exact output
        </span>
      </div>
    </div>
  );
}
