import type { Documents, VideoElement } from "../models/types";
import {
  projectDoc,
  sceneById,
  sceneEntries,
  flatten,
  uniqueId,
  timelineDoc,
  brandingDoc,
} from "./projectModel";

export function createElement(
  documents: Documents,
  sceneId: string,
  type: string,
  assetId?: string,
): VideoElement {
  const project = projectDoc(documents),
    scene = sceneById(documents, sceneId)!;
  const id = uniqueId(
    type,
    flatten(scene.elements).map((element) => element.id),
  );
  const common: VideoElement = {
    id,
    type,
    layer:
      Math.max(0, ...scene.elements.map((element) => element.layer ?? 0)) + 1,
    transform: {
      position: [project.canvas.width * 0.15, project.canvas.height * 0.25],
      anchor: [0, 0],
      opacity: 1,
    },
  };
  if (type === "text")
    return { ...common, text: "Your message", size: 64, color: "#FFFFFF" };
  if (type === "image" || type === "video")
    return {
      ...common,
      asset: assetId,
      width: project.canvas.width * 0.3,
      fit: "contain",
    };
  if (type === "shape")
    return {
      ...common,
      shape: "rectangle",
      width: 220,
      height: 130,
      fill: brandingDoc(documents).colors?.primary ?? "#51D6C3",
      cornerRadius: 12,
    };
  if (type === "path")
    return {
      ...common,
      transform: { position: [0, 0] },
      ...(assetId
        ? { asset: assetId }
        : {
            points: [
              [100, 300],
              [500, 300],
              [700, 500],
            ] as [number, number][],
          }),
      stroke: "#51D6C3",
      strokeWidth: 4,
    };
  return {
    ...common,
    transform: { position: [0, 0] },
    children: [
      {
        id: uniqueId(
          "group-text",
          flatten(scene.elements).map((item) => item.id),
        ),
        type: "text",
        text: "Group",
        size: 48,
        transform: { position: [100, 100] },
      },
    ],
  };
}
export function addScene(documents: Documents): string {
  const project = projectDoc(documents),
    entries = sceneEntries(documents),
    timeline = timelineDoc(documents);
  const id = uniqueId(
    "scene",
    entries.map((item) => item.scene.id),
  );
  const file = `scenes/${id}.json`,
    start = Math.max(
      0,
      ...timeline.clips.map((clip) => clip.start + clip.duration),
    );
  documents[file] = {
    id,
    elements: [
      {
        id: "title",
        type: "text",
        text: "A new scene",
        size: 72,
        transform: { position: [120, 200] },
      },
    ],
  };
  project.scenes.push(file);
  timeline.clips.push({
    id: uniqueId(
      id,
      timeline.clips.map((clip) => clip.id),
    ),
    scene: id,
    start,
    duration: 4,
  });
  project.timeline.duration = Math.max(project.timeline.duration, start + 4);
  return id;
}
export function duplicateElement(
  documents: Documents,
  sceneId: string,
  id: string,
): string | null {
  const scene = sceneById(documents, sceneId);
  if (!scene) return null;
  const all = flatten(scene.elements),
    original = all.find((element) => element.id === id);
  if (!original) return null;
  const ids = all.map((element) => element.id),
    clone = structuredClone(original);
  const rename = (element: VideoElement) => {
    element.id = uniqueId(`${element.id}-copy`, ids);
    ids.push(element.id);
    element.children?.forEach(rename);
  };
  rename(clone);
  clone.transform = {
    ...clone.transform,
    position: [
      (clone.transform?.position?.[0] ?? 0) + 30,
      (clone.transform?.position?.[1] ?? 0) + 30,
    ],
  };
  scene.elements.push(clone);
  return clone.id;
}
