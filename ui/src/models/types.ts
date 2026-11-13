export type Vec2 = [number, number];
export type AssetType = "image" | "font" | "audio" | "video" | "path";
export interface Asset {
  id: string;
  type: AssetType;
  source: string;
}
export interface Transform {
  position?: Vec2;
  anchor?: Vec2;
  scale?: Vec2;
  rotation?: number;
  opacity?: number;
}
export interface Effect {
  type: string;
  color?: string;
  radius?: number;
  intensity?: number;
  offset?: Vec2;
  duration?: number;
  samples?: number;
}
export interface VideoElement {
  id: string;
  type: string;
  binding?: string;
  asset?: string;
  style?: string;
  layer?: number;
  transform?: Transform;
  visibility?: { start?: number; end?: number };
  effects?: Effect[];
  text?: string;
  font?: string;
  size?: number;
  color?: string;
  align?: "left" | "center" | "right";
  lineSpacing?: number;
  width?: number;
  height?: number;
  fit?: string;
  shape?: string;
  radius?: number;
  cornerRadius?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  path?: string;
  points?: Vec2[];
  segments?: Vec2[][];
  progress?: number;
  trimStart?: number;
  playbackSpeed?: number;
  children?: VideoElement[];
}
export interface Scene {
  layout?: string;
  composition?: string;
  values?: Record<string, string>;
  activeNavigationItem?: string;
  camera?: {
    focus?: Rect;
    transition?: number;
    fit?: "fill" | "contain";
    easing?: string;
  };
  id: string;
  elements: VideoElement[];
}
export interface Clip {
  id: string;
  scene: string;
  start: number;
  duration: number;
  layer?: number;
}
export interface MotionPath {
  id: string;
  type?: "polyline" | "bezier";
  points: Vec2[];
}
export type TrackValue = number | string | number[];
export interface Keyframe {
  time: number;
  value: TrackValue;
  easing?: string;
}
export interface Track {
  id: string;
  target: string;
  property?: string;
  keyframes?: Keyframe[];
  animation?: string;
  path?: string;
  start?: number;
  duration?: number;
  easing?: string;
  repeat?: number;
  before?: string;
  after?: string;
  parameters?: {
    from?: TrackValue;
    to?: TrackValue;
    path?: string;
    property?: string;
    speedMode?: string;
    orientToPath?: boolean;
  };
}
export interface AudioTrack {
  id: string;
  asset: string;
  start: number;
  duration: number;
  trimStart?: number;
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
}
export interface Timeline {
  clips: Clip[];
  paths?: MotionPath[];
  tracks?: Track[];
  audio?: AudioTrack[];
}
export interface TextStyle {
  font?: string;
  size?: number;
  color?: string;
  align?: "left" | "center" | "right";
  lineSpacing?: number;
}
export interface Branding {
  logo?: string;
  colors?: Record<string, string>;
  textStyles?: Record<string, TextStyle>;
}
export interface ProjectDocument {
  schemaVersion: string;
  id: string;
  name: string;
  canvas: { width: number; height: number; background?: string };
  timeline: { duration: number; fps: number; file: string };
  assets: string;
  branding?: string;
  scenes: string[];
  layouts?: string[];
  compositions?: string[];
  export: string;
}
export interface ExportSettings {
  filename: string;
  directory?: string;
  resolution?: { width: number; height: number };
  video?: {
    codec?: string;
    quality?: number;
    preset?: string;
    pixelFormat?: string;
  };
  audio?: { enabled?: boolean; bitrate?: string };
  loop?: { validateSeam?: boolean; tolerance?: number };
}
export type Documents = Record<string, unknown>;
export interface AssetMetadata {
  type: string;
  source: string;
  url?: string;
  width?: number;
  height?: number;
  bytes?: number;
  error?: string;
  pathData?: { points?: Vec2[]; segments?: Vec2[][] };
}
export interface Bundle {
  project: string;
  revision: string;
  readOnly: boolean;
  documents: Documents;
  assetMetadata: Record<string, AssetMetadata>;
}
export interface ProjectSummary {
  project: string;
  id: string;
  name: string;
  canvas: { width: number; height: number };
  duration: number;
  fps: number;
  modifiedAt: number;
}
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  frames?: number;
}
export interface Job {
  id: string;
  project: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  error?: string;
  createdAt?: string;
  completedAt?: string;
  manifest?: {
    duration: number;
    resolution: number[];
    loopSeam?: { passes: boolean };
  };
}
export type Tab =
  | "projects"
  | "assets"
  | "branding"
  | "layouts"
  | "scenes"
  | "timeline"
  | "preview"
  | "export";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface LayoutDesign {
  id: string;
  name: string;
  elements: VideoElement[];
  viewport: Rect;
  navigation?: {
    items: { id: string; label: string }[];
    x?: number;
    y?: number;
    width?: number;
    size?: number;
    color?: string;
    activeColor?: string;
    underline?: boolean;
    font?: string;
  };
}
export interface Composition {
  id: string;
  name: string;
  canvas: { width: number; height: number };
  elements: VideoElement[];
}
