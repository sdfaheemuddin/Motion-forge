import { describe, it, expect } from "vitest";
import {
  historyReducer,
  initialHistory,
  removeElement,
  shiftTrack,
  trackInterval,
  projectDoc,
} from "../src/viewmodels/projectModel";
import {
  samplePath,
  trackValues,
  animatedState,
} from "../src/viewmodels/animationModel";
import {
  createElement,
  addScene,
  duplicateElement,
} from "../src/viewmodels/sceneModel";
import type { Bundle, Documents, Timeline } from "../src/models/types";
function fixture(): Bundle {
  return {
    project: "projects/test/project.json",
    revision: "one",
    readOnly: false,
    assetMetadata: {},
    documents: {
      "project.json": {
        id: "test",
        name: "Test",
        canvas: { width: 640, height: 360 },
        timeline: { file: "timeline.json", duration: 10, fps: 24 },
        assets: "assets.json",
        export: "export.json",
        scenes: ["scenes/main.json", "scenes/other.json"],
      },
      "assets.json": { assets: [] },
      "export.json": { filename: "test.mp4" },
      "scenes/main.json": {
        id: "main",
        elements: [
          {
            id: "group",
            type: "group",
            children: [{ id: "title", type: "text", text: "Hello" }],
          },
        ],
      },
      "scenes/other.json": {
        id: "other",
        elements: [{ id: "title", type: "text", text: "Other title" }],
      },
      "timeline.json": {
        clips: [
          { id: "a", scene: "main", start: 0, duration: 5 },
          { id: "b", scene: "other", start: 5, duration: 5 },
        ],
        tracks: [
          {
            id: "fade",
            target: "a/title",
            animation: "fadeIn",
            start: 0,
            duration: 1,
          },
          {
            id: "other-fade",
            target: "b/title",
            animation: "fadeIn",
            start: 5,
            duration: 1,
          },
        ],
      },
    },
  };
}
describe("project editing", () => {
  it("undoes, redoes, and clears redo after a new edit", () => {
    let state = historyReducer(initialHistory, {
      type: "load",
      bundle: fixture(),
    });
    const edit = (name: string) => ({
      type: "edit" as const,
      update: (docs: Documents) => {
        projectDoc(docs).name = name;
      },
    });
    state = historyReducer(state, edit("Changed"));
    state = historyReducer(state, { type: "undo" });
    expect(projectDoc(state.bundle!.documents).name).toBe("Test");
    state = historyReducer(state, { type: "redo" });
    expect(projectDoc(state.bundle!.documents).name).toBe("Changed");
    state = historyReducer(state, { type: "undo" });
    state = historyReducer(state, edit("New edit"));
    expect(state.future).toHaveLength(0);
  });
  it("preserves edits made during an in-flight save", () => {
    const bundle = fixture();
    let state = historyReducer(initialHistory, { type: "load", bundle });
    state = historyReducer(state, {
      type: "edit",
      update: (docs) => {
        projectDoc(docs).name = "While saving";
      },
    });
    state = historyReducer(state, {
      type: "saved",
      bundle: { ...bundle, revision: "two" },
      submitted: bundle.documents,
    });
    expect(projectDoc(state.bundle!.documents).name).toBe("While saving");
    expect(state.bundle!.revision).toBe("two");
    expect(JSON.stringify(state.bundle!.documents)).not.toBe(state.saved);
  });
  it("removes child animation tracks only for the deleted scene", () => {
    const docs = fixture().documents;
    removeElement(docs, "main", "group");
    expect(
      (docs["timeline.json"] as Timeline).tracks?.map((track) => track.id),
    ).toEqual(["other-fade"]);
  });
  it("copies nested IDs without collisions and extends the timeline for a scene", () => {
    const docs = fixture().documents;
    expect(duplicateElement(docs, "main", "group")).toBe("group-copy");
    expect(addScene(docs)).toBe("scene");
    expect(projectDoc(docs).timeline.duration).toBe(14);
  });
  it("adds a path asset by reference without replacing its geometry", () => {
    const element = createElement(
      fixture().documents,
      "main",
      "path",
      "route-asset",
    );
    expect(element.asset).toBe("route-asset");
    expect(element.points).toBeUndefined();
  });
  it("moves all keyframes together without mutating the original", () => {
    const track = {
      id: "move",
      target: "a/title",
      keyframes: [
        { time: 2, value: 0 },
        { time: 4, value: 1 },
      ],
    };
    expect(trackInterval(shiftTrack(track, 1))).toEqual([3, 5]);
    expect(track.keyframes[0].time).toBe(2);
  });
});
describe("continuous project clock", () => {
  const route = {
    id: "route",
    points: [
      [0, 0],
      [100, 0],
      [100, 100],
    ] as [number, number][],
  };
  it("samples equal distance before and after a route corner", () => {
    expect(samplePath(route, 0.25).point).toEqual([50, 0]);
    expect(samplePath(route, 0.75).point).toEqual([100, 50]);
  });
  it("keeps travelling across caption changes and holds its endpoint", () => {
    const track = {
      id: "energy",
      target: "a/dot",
      animation: "followPath",
      start: 0,
      duration: 10,
      parameters: { path: "route" },
    };
    expect(trackValues(track, 4.9, [route]).position).toEqual([
      98.00000000000001, 0,
    ]);
    expect(trackValues(track, 5.1, [route]).position).toEqual([100, 2]);
    expect(trackValues(track, 12, [route]).position).toEqual([100, 100]);
  });
  it("lets a later started animation take over from held values", () => {
    const timeline: Timeline = {
      clips: [],
      tracks: [
        {
          id: "in",
          target: "a/dot",
          animation: "fadeIn",
          start: 0,
          duration: 1,
        },
        {
          id: "out",
          target: "a/dot",
          animation: "fadeOut",
          start: 3,
          duration: 1,
        },
      ],
    };
    expect(
      animatedState({ id: "dot", type: "shape" }, "a", timeline, 2).transform!
        .opacity,
    ).toBe(1);
    expect(
      animatedState({ id: "dot", type: "shape" }, "a", timeline, 3.5).transform!
        .opacity,
    ).toBe(0.5);
  });
});
