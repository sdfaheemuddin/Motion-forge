import type {
  Bundle,
  Documents,
  ProjectDocument,
  Scene,
  Timeline,
  Asset,
  Branding,
  ExportSettings,
  VideoElement,
  Track,
} from "../models/types";

export function projectDoc(documents: Documents): ProjectDocument {
  return documents["project.json"] as ProjectDocument;
}
export function assetDoc(documents: Documents): { assets: Asset[] } {
  return documents[projectDoc(documents).assets] as { assets: Asset[] };
}
export function timelineDoc(documents: Documents): Timeline {
  return documents[projectDoc(documents).timeline.file] as Timeline;
}
export function brandingDoc(documents: Documents): Branding {
  const path = projectDoc(documents).branding;
  return path ? (documents[path] as Branding) : {};
}
export function exportDoc(documents: Documents): ExportSettings {
  return documents[projectDoc(documents).export] as ExportSettings;
}
export function sceneEntries(
  documents: Documents,
): { file: string; scene: Scene }[] {
  return projectDoc(documents).scenes.map((file) => ({
    file,
    scene: documents[file] as Scene,
  }));
}
export function sceneById(documents: Documents, id: string) {
  return sceneEntries(documents).find((item) => item.scene.id === id)?.scene;
}
export function flatten(elements: VideoElement[]): VideoElement[] {
  return elements.flatMap((element) => [
    element,
    ...flatten(element.children ?? []),
  ]);
}
export function elementById(
  documents: Documents,
  sceneId: string,
  elementId: string,
) {
  return flatten(sceneById(documents, sceneId)?.elements ?? []).find(
    (element) => element.id === elementId,
  );
}
export function uniqueId(base: string, ids: string[]) {
  let id = base,
    n = 2;
  while (ids.includes(id)) id = `${base}-${n++}`;
  return id;
}
export function trackInterval(track: Track): [number, number] {
  return track.keyframes?.length
    ? [
        track.keyframes[0].time,
        track.keyframes[track.keyframes.length - 1].time,
      ]
    : [
        track.start ?? 0,
        (track.start ?? 0) + (track.duration ?? 1) * ((track.repeat ?? 0) + 1),
      ];
}
export function shiftTrack(track: Track, delta: number): Track {
  const result = structuredClone(track);
  const rounded = (value: number) => Math.round(value * 1e6) / 1e6;
  if (result.keyframes)
    result.keyframes = result.keyframes.map((frame) => ({
      ...frame,
      time: rounded(frame.time + delta),
    }));
  else result.start = rounded((result.start ?? 0) + delta);
  return result;
}
export function ensureBranding(documents: Documents): Branding {
  const project = projectDoc(documents);
  if (!project.branding) {
    project.branding = "branding.json";
    documents[project.branding] = { colors: {}, textStyles: {} };
  }
  return documents[project.branding] as Branding;
}
export function removeElement(
  documents: Documents,
  sceneId: string,
  id: string,
) {
  const scene = sceneById(documents, sceneId);
  if (!scene) return;
  const removed = flatten(
    [elementById(documents, sceneId, id)!].filter(Boolean),
  ).map((element) => element.id);
  const filter = (elements: VideoElement[]): VideoElement[] =>
    elements
      .filter((element) => element.id !== id)
      .map((element) => ({
        ...element,
        ...(element.children ? { children: filter(element.children) } : {}),
      }));
  scene.elements = filter(scene.elements);
  const timeline = timelineDoc(documents);
  const clips = timeline.clips
    .filter((clip) => clip.scene === sceneId)
    .map((clip) => clip.id);
  timeline.tracks = (timeline.tracks ?? []).filter(
    (track) =>
      !clips.some((clip) =>
        removed.some((id) => track.target === `${clip}/${id}`),
      ),
  );
}
export function assetUsage(documents: Documents, assetId: string): string[] {
  const uses = sceneEntries(documents).flatMap(({ scene }) =>
    flatten(scene.elements)
      .filter(
        (element) => element.asset === assetId || element.font === assetId,
      )
      .map((element) => `${scene.id} / ${element.id}`),
  );
  const branding = brandingDoc(documents);
  if (branding.logo === assetId) uses.push("Branding logo");
  for (const [name, style] of Object.entries(branding.textStyles ?? {}))
    if (style.font === assetId) uses.push(`Text style / ${name}`);
  for (const track of timelineDoc(documents).audio ?? [])
    if (track.asset === assetId) uses.push(`Audio / ${track.id}`);
  return uses;
}

export interface HistoryState {
  bundle: Bundle | null;
  past: Documents[];
  future: Documents[];
  saved: string;
}
export type HistoryAction =
  | { type: "load"; bundle: Bundle }
  | { type: "edit"; update: (documents: Documents) => void }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "saved"; bundle: Bundle; submitted: Documents }
  | { type: "upload"; asset: Asset; metadata: Bundle["assetMetadata"][string] };
export const initialHistory: HistoryState = {
  bundle: null,
  past: [],
  future: [],
  saved: "",
};
export function historyReducer(
  state: HistoryState,
  action: HistoryAction,
): HistoryState {
  if (action.type === "load")
    return {
      bundle: action.bundle,
      past: [],
      future: [],
      saved: JSON.stringify(action.bundle.documents),
    };
  if (!state.bundle) return state;
  if (action.type === "saved") {
    if (state.bundle.project !== action.bundle.project) return state;
    // Preserve edits made while the save request was in flight.
    const changed =
      JSON.stringify(state.bundle.documents) !==
      JSON.stringify(action.submitted);
    return {
      ...state,
      bundle: changed
        ? { ...state.bundle, revision: action.bundle.revision }
        : action.bundle,
      saved: JSON.stringify(action.bundle.documents),
    };
  }
  if (action.type === "undo") {
    if (!state.past.length) return state;
    return {
      ...state,
      bundle: { ...state.bundle, documents: state.past[state.past.length - 1] },
      past: state.past.slice(0, -1),
      future: [state.bundle.documents, ...state.future],
    };
  }
  if (action.type === "redo") {
    if (!state.future.length) return state;
    return {
      ...state,
      bundle: { ...state.bundle, documents: state.future[0] },
      past: [...state.past, state.bundle.documents],
      future: state.future.slice(1),
    };
  }
  const documents = structuredClone(state.bundle.documents);
  if (action.type === "edit") action.update(documents);
  if (action.type === "upload") assetDoc(documents).assets.push(action.asset);
  if (JSON.stringify(documents) === JSON.stringify(state.bundle.documents))
    return state;
  const metadata =
    action.type === "upload"
      ? { ...state.bundle.assetMetadata, [action.asset.id]: action.metadata }
      : state.bundle.assetMetadata;
  return {
    ...state,
    bundle: { ...state.bundle, documents, assetMetadata: metadata },
    past: [...state.past.slice(-49), state.bundle.documents],
    future: [],
  };
}
