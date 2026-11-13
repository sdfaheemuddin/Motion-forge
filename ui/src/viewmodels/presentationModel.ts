import type {
  Documents,
  LayoutDesign,
  Composition,
  Scene,
  VideoElement,
  Rect,
  Clip,
  Branding,
} from "../models/types";
import {
  projectDoc,
  timelineDoc,
  sceneEntries,
  uniqueId,
  brandingDoc,
  flatten,
} from "./projectModel";

export function layouts(
  d: Documents,
): { file: string; design: LayoutDesign }[] {
  return (projectDoc(d).layouts ?? []).map((file) => ({
    file,
    design: d[file] as LayoutDesign,
  }));
}
export function compositions(
  d: Documents,
): { file: string; composition: Composition }[] {
  return (projectDoc(d).compositions ?? []).map((file) => ({
    file,
    composition: d[file] as Composition,
  }));
}
export function editableEntries(d: Documents) {
  return [
    ...layouts(d).map((x) => ({ file: x.file, scene: x.design as Scene })),
    ...compositions(d).map((x) => ({
      file: x.file,
      scene: x.composition as Scene,
    })),
    ...sceneEntries(d).filter((x) => !x.scene.layout),
  ];
}
export function bindings(layout: LayoutDesign) {
  return flatten(layout.elements).filter((e) => e.binding);
}
export function overlayElements(
  layout: LayoutDesign,
  scene: Partial<Scene>,
  branding: Branding,
): VideoElement[] {
  function resolve(elements: VideoElement[]): VideoElement[] {
    return elements.flatMap((original) => {
      const e = structuredClone(original);
      if (e.binding) {
        const value =
          scene.values?.[e.binding] ??
          (e.binding === "logo" ? (branding.logo ?? "") : (e.text ?? ""));
        if (e.type === "text") e.text = value;
        else if (["image", "video"].includes(e.type)) {
          if (!value) return [];
          e.asset = value;
        }
        delete e.binding;
      }
      if (e.children) e.children = resolve(e.children);
      return [e];
    });
  }
  const result = resolve(layout.elements),
    nav = layout.navigation,
    items = nav?.items ?? [];
  items.forEach((item, index) => {
    const active =
        scene.activeNavigationItem === item.id ||
        scene.activeNavigationItem === "*",
      width = (nav?.width ?? 1600) / items.length,
      x = (nav?.x ?? 80) + index * width,
      y = nav?.y ?? 960,
      color = active
        ? (nav?.activeColor ?? "#70E1C4")
        : (nav?.color ?? "#718595");
    result.push({
      id: "nav-" + item.id,
      type: "text",
      text: item.label,
      size: nav?.size ?? 18,
      color,
      width: Math.max(1, width - 12),
      font: nav?.font,
      transform: { position: [x, y] },
    });
    if (active && nav?.underline !== false)
      result.push({
        id: "nav-line-" + item.id,
        type: "shape",
        shape: "rectangle",
        width: Math.max(1, width - 18),
        height: 3,
        fill: color,
        transform: { position: [x, y - 13] },
      });
  });
  return result;
}
export function adjustFocus(focus: Rect, viewport: Rect, fit = "fill"): Rect {
  const ratio = viewport.width / viewport.height,
    source = focus.width / focus.height;
  let { width, height } = focus;
  if (source > ratio === (fit === "fill")) width = height * ratio;
  else height = width / ratio;
  return {
    x: focus.x + (focus.width - width) / 2,
    y: focus.y + (focus.height - height) / 2,
    width,
    height,
  };
}
export function focusFor(d: Documents, scene: Scene, viewport: Rect): Rect {
  const comp = compositions(d).find(
    (x) => x.composition.id === scene.composition,
  )!.composition;
  return adjustFocus(
    scene.camera?.focus ?? { x: 0, y: 0, ...comp.canvas },
    viewport,
    scene.camera?.fit ?? "fill",
  );
}
export function cameraRect(d: Documents, clip: Clip, time: number): Rect {
  const scene = sceneEntries(d).find((x) => x.scene.id === clip.scene)!.scene,
    viewport = layouts(d).find((x) => x.design.id === scene.layout)!.design
      .viewport,
    target = focusFor(d, scene, viewport),
    previous = timelineDoc(d)
      .clips.filter(
        (c) =>
          c.id !== clip.id &&
          c.start + c.duration <= clip.start + 1e-6 &&
          sceneEntries(d).find((x) => x.scene.id === c.scene)?.scene
            .composition === scene.composition,
      )
      .sort((a, b) => b.start + b.duration - a.start - a.duration)[0];
  if (!previous) return target;
  const origin = focusFor(
      d,
      sceneEntries(d).find((x) => x.scene.id === previous.scene)!.scene,
      viewport,
    ),
    duration = scene.camera?.transition ?? 1.3;
  let t = duration
    ? Math.min(1, Math.max(0, (time - clip.start) / duration))
    : 1;
  const ease = scene.camera?.easing ?? "easeInOut";
  if (ease === "easeInOut") t = t * t * (3 - 2 * t);
  else if (ease === "easeIn") t *= t;
  else if (ease === "easeOut") t = 1 - (1 - t) ** 2;
  return {
    x: origin.x + (target.x - origin.x) * t,
    y: origin.y + (target.y - origin.y) * t,
    width: origin.width + (target.width - origin.width) * t,
    height: origin.height + (target.height - origin.height) * t,
  };
}
export function addLayout(d: Documents): string {
  const p = projectDoc(d),
    id = uniqueId("layout", [
      ...layouts(d).map((x) => x.design.id),
      ...sceneEntries(d).map((x) => x.scene.id),
      ...compositions(d).map((x) => x.composition.id),
    ]),
    w = p.canvas.width,
    h = p.canvas.height,
    file = `layouts/${id}.json`;
  d[file] = {
    id,
    name: "New layout",
    viewport: { x: w * 0.04, y: h * 0.3, width: w * 0.92, height: h * 0.56 },
    elements: [
      {
        id: "logo",
        type: "image",
        binding: "logo",
        width: w * 0.14,
        height: h * 0.08,
        transform: { position: [w * 0.05, h * 0.025] },
      },
      {
        id: "title",
        type: "text",
        binding: "title",
        text: "Scene title",
        size: Math.round(h * 0.055),
        width: w * 0.9,
        transform: { position: [w * 0.05, h * 0.13] },
      },
      {
        id: "subtitle",
        type: "text",
        binding: "subtitle",
        text: "Scene subtitle",
        size: Math.round(h * 0.027),
        width: w * 0.9,
        transform: { position: [w * 0.05, h * 0.22] },
      },
    ],
    navigation: {
      items: [
        { id: "first", label: "FIRST" },
        { id: "second", label: "SECOND" },
      ],
      x: w * 0.05,
      y: h * 0.92,
      width: w * 0.9,
      size: Math.round(h * 0.017),
      color: "#718595",
      activeColor: "#70E1C4",
      underline: true,
    },
  };
  (p.layouts ??= []).push(file);
  return id;
}
export function addPresentationScene(d: Documents, layoutId?: string): string {
  const p = projectDoc(d),
    timeline = timelineDoc(d),
    layout =
      layouts(d).find((x) => x.design.id === layoutId)?.design ??
      layouts(d)[0]?.design;
  if (!layout) throw new Error("Create a layout in Layout Design first.");
  let comp = compositions(d)[0]?.composition;
  if (!comp) {
    const id = uniqueId(
        "world",
        editableEntries(d).map((x) => x.scene.id),
      ),
      file = `compositions/${id}.json`;
    comp = {
      id,
      name: "Shared composition",
      canvas: { width: p.canvas.width, height: p.canvas.height },
      elements: [
        {
          id: "content",
          type: "text",
          text: "Add images and graphics in Layout Design",
          size: 40,
          transform: { position: [100, 200] },
        },
      ],
    };
    d[file] = comp;
    (p.compositions ??= []).push(file);
  }
  const id = uniqueId("scene", [
      ...sceneEntries(d).map((x) => x.scene.id),
      ...layouts(d).map((x) => x.design.id),
      ...compositions(d).map((x) => x.composition.id),
    ]),
    file = `scenes/${id}.json`,
    start = Math.max(0, ...timeline.clips.map((c) => c.start + c.duration));
  d[file] = {
    id,
    layout: layout.id,
    composition: comp.id,
    elements: [],
    values: Object.fromEntries(
      bindings(layout)
        .filter((e) => e.type === "text")
        .map((e) => [e.binding!, e.text ?? ""]),
    ),
    activeNavigationItem: "",
    camera: {
      focus: { x: 0, y: 0, ...comp.canvas },
      transition: 1.3,
      fit: "contain",
      easing: "easeInOut",
    },
  };
  p.scenes.push(file);
  timeline.clips.push({
    id: uniqueId(
      id,
      timeline.clips.map((c) => c.id),
    ),
    scene: id,
    start,
    duration: 4,
  });
  p.timeline.duration = Math.max(p.timeline.duration, start + 4);
  return id;
}
/** Scene timing is a contiguous storyboard; shared composition tracks retain global time. */
export function resizeScene(d: Documents, clipId: string, duration: number) {
  const p = projectDoc(d),
    timeline = timelineDoc(d),
    clip = timeline.clips.find((c) => c.id === clipId)!;
  const delta = duration - clip.duration,
    oldEnd = clip.start + clip.duration;
  clip.duration = duration;
  for (const next of timeline.clips)
    if (next.id !== clipId && next.start >= oldEnd - 1e-6) next.start += delta;
  p.timeline.duration = Math.max(
    ...timeline.clips.map((c) => c.start + c.duration),
  );
  const scene = sceneEntries(d).find((x) => x.scene.id === clip.scene)?.scene;
  if (scene?.camera && scene.camera.transition! > duration)
    scene.camera.transition = duration;
}

/** Pick the title slot by layout definition instead of assuming a fixed content key. */
export function sceneLabel(d: Documents, scene: Scene): string {
  const layout = layouts(d).find((x) => x.design.id === scene.layout)?.design;
  const slots = layout ? bindings(layout).filter((e) => e.type === "text") : [];
  const title =
    slots.find((e) => e.id === "title" || e.binding === "title") ?? slots[0];
  return title
    ? (scene.values?.[title.binding!] ?? title.text ?? scene.id)
    : scene.id;
}

/** Preserve legacy artwork and animation targets when assigning its first reusable layout. */
export function assignLayout(d: Documents, sceneId: string, layoutId: string) {
  const p = projectDoc(d),
    entry = sceneEntries(d).find((x) => x.scene.id === sceneId)!;
  const s = entry.scene;
  if (!s.composition) {
    const id = uniqueId(`${sceneId}-world`, [
        ...editableEntries(d).map((x) => x.scene.id),
        ...sceneEntries(d).map((x) => x.scene.id),
        ...timelineDoc(d).clips.map((x) => x.id),
      ]),
      file = `compositions/${id}.json`;
    d[file] = {
      id,
      name: `${sceneId} content`,
      canvas: { width: p.canvas.width, height: p.canvas.height },
      elements: structuredClone(
        s.elements.length
          ? s.elements
          : [
              {
                id: "content",
                type: "text",
                text: "Add content in Layout Design",
              },
            ],
      ),
    };
    (p.compositions ??= []).push(file);
    s.composition = id;
    const ids = timelineDoc(d)
      .clips.filter((c) => c.scene === s.id)
      .map((c) => c.id);
    for (const track of timelineDoc(d).tracks ?? [])
      if (ids.includes(track.target.split("/")[0]))
        track.target = `${id}/${track.target.split("/")[1]}`;
  }
  s.layout = layoutId;
  s.elements = [];
  s.activeNavigationItem = "";
}
