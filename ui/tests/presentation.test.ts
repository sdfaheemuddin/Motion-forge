import { describe, it, expect } from "vitest";
import {
  overlayElements,
  adjustFocus,
  cameraRect,
  resizeScene,
  addLayout,
  addPresentationScene,
  assignLayout,
} from "../src/viewmodels/presentationModel";
import type { Documents, LayoutDesign, Scene } from "../src/models/types";
const layout: LayoutDesign = {
  id: "layout",
  name: "Layout",
  elements: [
    {
      id: "title",
      type: "text",
      binding: "title",
      text: "Default",
      transform: { position: [20, 30] },
    },
  ],
  viewport: { x: 0, y: 30, width: 80, height: 50 },
  navigation: {
    items: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ],
    color: "#555555",
    activeColor: "#00FFFF",
  },
};
function documents(): Documents {
  return {
    "project.json": {
      schemaVersion: "1.0",
      id: "test",
      name: "Test",
      canvas: { width: 160, height: 100 },
      timeline: { file: "timeline.json", duration: 4, fps: 10 },
      scenes: ["scenes/a.json", "scenes/b.json"],
      layouts: ["layouts/main.json"],
      compositions: ["compositions/world.json"],
      assets: "assets.json",
      export: "export.json",
    },
    "layouts/main.json": structuredClone(layout),
    "compositions/world.json": {
      id: "world",
      name: "World",
      canvas: { width: 160, height: 50 },
      elements: [{ id: "point", type: "shape" }],
    },
    "scenes/a.json": {
      id: "a",
      elements: [],
      layout: "layout",
      composition: "world",
      values: { title: "First" },
      activeNavigationItem: "a",
      camera: { focus: { x: 0, y: 0, width: 80, height: 50 }, transition: 1 },
    },
    "scenes/b.json": {
      id: "b",
      elements: [],
      layout: "layout",
      composition: "world",
      values: { title: "Second" },
      activeNavigationItem: "b",
      camera: { focus: { x: 80, y: 0, width: 80, height: 50 }, transition: 1 },
    },
    "timeline.json": {
      clips: [
        { id: "a-clip", scene: "a", start: 0, duration: 2 },
        { id: "b-clip", scene: "b", start: 2, duration: 2 },
      ],
      tracks: [
        {
          id: "travel",
          target: "world/point",
          animation: "followPath",
          start: 0,
          duration: 4,
        },
      ],
    },
    "assets.json": { assets: [] },
    "export.json": { filename: "test.mp4" },
  };
}
describe("layout and scene model", () => {
  it("changes content and active labels without mutating the shared layout", () => {
    const d = documents(),
      a = overlayElements(layout, d["scenes/a.json"] as Scene, {}),
      b = overlayElements(layout, d["scenes/b.json"] as Scene, {});
    expect(a[0].text).toBe("First");
    expect(b[0].text).toBe("Second");
    expect(a.find((e) => e.id === "nav-a")?.color).toBe("#00FFFF");
    expect(b.find((e) => e.id === "nav-a")?.color).toBe("#555555");
    expect(layout.elements[0].text).toBe("Default");
  });
  it("interpolates from the prior focus on the project clock", () => {
    const d = documents(),
      clip = { id: "b-clip", scene: "b", start: 2, duration: 2 };
    expect(cameraRect(d, clip, 2).x).toBe(0);
    expect(cameraRect(d, clip, 2.5).x).toBe(40);
    expect(cameraRect(d, clip, 3).x).toBe(80);
  });
  it("preserves aspect ratio for Fit and Fill", () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 },
      viewport = { x: 0, y: 0, width: 200, height: 100 };
    expect(adjustFocus(rect, viewport, "fill")).toEqual({
      x: 0,
      y: 25,
      width: 100,
      height: 50,
    });
    expect(adjustFocus(rect, viewport, "contain")).toEqual({
      x: -50,
      y: 0,
      width: 200,
      height: 100,
    });
  });
  it("resizes the scene sequence without retiming continuous composition tracks", () => {
    const d = documents();
    resizeScene(d, "a-clip", 3);
    const t = d["timeline.json"] as {
      clips: { start: number }[];
      tracks: { duration: number }[];
    };
    expect(t.clips[1].start).toBe(3);
    expect(t.tracks[0].duration).toBe(4);
  });
  it("creates multiple layouts and scene instances with distinct IDs", () => {
    const d = documents();
    expect(addLayout(d)).toBe("layout-2");
    const scene = addPresentationScene(d);
    expect((d[`scenes/${scene}.json`] as Scene).layout).toBe("layout");
  });
  it("assigns a first layout to legacy artwork without dropping elements or movement", () => {
    const d = documents();
    d["scenes/a.json"] = {
      id: "a",
      elements: [
        { id: "legacy-point", type: "shape", shape: "circle", radius: 5 },
      ],
    };
    (d["timeline.json"] as { tracks: unknown[] }).tracks = [
      {
        id: "move",
        target: "a-clip/legacy-point",
        animation: "fadeIn",
        start: 0,
        duration: 1,
      },
    ];
    assignLayout(d, "a", "layout");
    const scene = d["scenes/a.json"] as Scene;
    expect(scene.elements).toEqual([]);
    expect(scene.composition).toBe("a-world");
    expect(
      (d["compositions/a-world.json"] as { elements: { id: string }[] })
        .elements[0].id,
    ).toBe("legacy-point");
    expect(
      (d["timeline.json"] as { tracks: { target: string }[] }).tracks[0].target,
    ).toBe("a-world/legacy-point");
  });
});
