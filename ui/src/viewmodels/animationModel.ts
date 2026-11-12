import type {
  Track,
  TrackValue,
  MotionPath,
  Vec2,
  VideoElement,
  Timeline,
} from "../models/types";
import { trackInterval } from "./projectModel";

export function easing(name: string | undefined, t: number) {
  t = Math.max(0, Math.min(1, t));
  return name === "easeIn"
    ? t * t
    : name === "easeOut"
      ? 1 - (1 - t) ** 2
      : name === "easeInOut"
        ? t * t * (3 - 2 * t)
        : t;
}
function mix(a: TrackValue, b: TrackValue, fraction: number): TrackValue {
  if (typeof a === "number" && typeof b === "number")
    return a + (b - a) * fraction;
  if (Array.isArray(a) && Array.isArray(b))
    return a.map(
      (value, index) => value + ((b[index] ?? value) - value) * fraction,
    );
  if (
    typeof a === "string" &&
    typeof b === "string" &&
    /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(a) &&
    /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(b)
  ) {
    const first = a.length === 7 ? `${a}ff` : a,
      second = b.length === 7 ? `${b}ff` : b;
    return (
      "#" +
      [1, 3, 5, 7]
        .map((index) =>
          Math.round(
            parseInt(first.slice(index, index + 2), 16) +
              (parseInt(second.slice(index, index + 2), 16) -
                parseInt(first.slice(index, index + 2), 16)) *
                fraction,
          )
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")
    );
  }
  return fraction >= 1 ? b : a;
}
export function pathPoints(path: MotionPath): Vec2[] {
  if (path.type !== "bezier") return path.points;
  const result: Vec2[] = [];
  for (let index = 0; index + 3 < path.points.length; index += 3) {
    const [a, b, c, d] = path.points.slice(index, index + 4);
    for (let sample = 0; sample <= 128; sample++) {
      const t = sample / 128;
      result.push(
        [0, 1].map(
          (axis) =>
            (1 - t) ** 3 * a[axis] +
            3 * (1 - t) ** 2 * t * b[axis] +
            3 * (1 - t) * t ** 2 * c[axis] +
            t ** 3 * d[axis],
        ) as Vec2,
      );
    }
  }
  return result;
}
export function samplePath(
  path: MotionPath,
  progress: number,
): { point: Vec2; angle: number } {
  const points = pathPoints(path);
  if (points.length < 2) return { point: points[0] ?? [0, 0], angle: 0 };
  const lengths = points
    .slice(1)
    .map((point, index) =>
      Math.hypot(point[0] - points[index][0], point[1] - points[index][1]),
    );
  let remaining =
    lengths.reduce((sum, value) => sum + value, 0) *
    Math.max(0, Math.min(1, progress));
  for (let index = 0; index < lengths.length; index++) {
    const a = points[index],
      b = points[index + 1],
      length = lengths[index];
    if (length && (remaining <= length || index === lengths.length - 1)) {
      const fraction = Math.max(0, Math.min(1, remaining / length));
      return {
        point: [
          a[0] + (b[0] - a[0]) * fraction,
          a[1] + (b[1] - a[1]) * fraction,
        ],
        angle: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI,
      };
    }
    remaining -= length;
  }
  return { point: points[points.length - 1], angle: 0 };
}
export function trackValues(
  track: Track,
  time: number,
  paths: MotionPath[],
): Record<string, TrackValue> {
  const [start, end] = trackInterval(track);
  if (
    (time < start && track.before === "base") ||
    (time > end && track.after === "base")
  )
    return {};
  if (track.keyframes?.length) {
    const frames = track.keyframes;
    let value = frames[0].value;
    for (let index = 1; index < frames.length; index++) {
      if (time >= frames[index].time) value = frames[index].value;
      else if (time >= frames[index - 1].time) {
        value = mix(
          frames[index - 1].value,
          frames[index].value,
          easing(
            frames[index].easing,
            (time - frames[index - 1].time) /
              (frames[index].time - frames[index - 1].time),
          ),
        );
        break;
      }
    }
    return { [track.property ?? "opacity"]: value };
  }
  const raw =
      time <= start
        ? 0
        : time >= end
          ? 1
          : ((time - start) % (track.duration ?? 1)) / (track.duration ?? 1),
    progress = easing(track.easing, raw),
    p = track.parameters ?? {};
  if (track.animation === "followPath") {
    const path = paths.find((item) => item.id === (track.path ?? p.path));
    if (!path) return {};
    const result = samplePath(path, progress);
    return {
      position: result.point,
      ...(p.orientToPath ? { rotation: result.angle } : {}),
    };
  }
  if (track.animation === "pulse")
    return {
      [p.property ?? "opacity"]: mix(
        p.from ?? 0.4,
        p.to ?? 1,
        (1 - Math.cos(progress * Math.PI * 2)) / 2,
      ),
    };
  const definitions: Record<string, [string, TrackValue, TrackValue]> = {
    fadeIn: ["opacity", 0, 1],
    fadeOut: ["opacity", 1, 0],
    slideIn: ["position", [-200, 0], [0, 0]],
    zoomIn: ["scale", [0.8, 0.8], [1, 1]],
    wipeReveal: ["reveal", 0, 1],
    typewriter: ["textReveal", 0, 1],
  };
  const definition = definitions[track.animation ?? ""];
  return definition
    ? {
        [definition[0]]: mix(
          p.from ?? definition[1],
          p.to ?? definition[2],
          progress,
        ),
      }
    : {};
}
export function animatedState(
  element: VideoElement,
  clipId: string,
  timeline: Timeline,
  time: number,
): VideoElement & { reveal?: number; textReveal?: number } {
  const result = {
    ...element,
    transform: {
      position: [0, 0] as Vec2,
      anchor: [0, 0] as Vec2,
      scale: [1, 1] as Vec2,
      opacity: 1,
      rotation: 0,
      ...element.transform,
    },
    effects: element.effects?.map((effect) => ({ ...effect })),
  } as VideoElement & { reveal?: number; textReveal?: number };
  const values = new Map<
    string,
    { value: TrackValue; priority: [number, number] }
  >();
  for (const track of timeline.tracks ?? []) {
    if (track.target !== `${clipId}/${element.id}`) continue;
    const start = trackInterval(track)[0],
      priority: [number, number] = [
        start <= time ? 1 : 0,
        start <= time ? start : -start,
      ];
    for (const [key, value] of Object.entries(
      trackValues(track, time, timeline.paths ?? []),
    )) {
      const old = values.get(key);
      if (
        !old ||
        priority[0] > old.priority[0] ||
        (priority[0] === old.priority[0] && priority[1] > old.priority[1])
      )
        values.set(key, { value, priority });
    }
  }
  for (const [key, { value }] of values) {
    if (["position", "anchor", "scale", "rotation", "opacity"].includes(key))
      Object.assign(result.transform!, { [key]: value });
    else if (key.startsWith("effects.")) {
      const [, index, field] = key.split(".");
      if (result.effects?.[+index])
        Object.assign(result.effects[+index], { [field]: value });
    } else Object.assign(result, { [key]: value });
  }
  return result;
}
