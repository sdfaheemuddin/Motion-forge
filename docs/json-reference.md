# JSON contract v1.0

Canonical validation schemas are in `schemas/`. Unknown fields are rejected. `schemaVersion` is the string `"1.0"`. JSON paths and asset sources are interpreted relative to the entry project.json, even when a scene JSON lives in a subdirectory. Assets can reference local files; URL downloading is not performed.

## Project and export

The canvas defines the coordinate system. `timeline.duration` is seconds and `timeline.fps` is a positive integer up to 120. Their product must be a whole frame count. Clips and tracks cannot extend beyond the project. FPS is declared only once. Export resolution can differ from the canvas, and final frames are resized. Width and height must be even for H.264 yuv420p. `video.quality` is CRF 0–51 (lower means higher quality); default is 18.

`export.audio.enabled` defaults to false. `loop.validateSeam` compares first and last rendered frames. `loop.tolerance` is the allowed mean RGB-channel difference on the 0–255 scale, default 1. It cannot guarantee a perceptually seamless velocity transition and does not rewrite frames.

## Assets and styles

Assets require `id`, `type` and `source`. Types are image, path, font, video and audio. Path assets are JSON documents containing points or segments; they keep reusable linework out of scene files. The system font aliases are `system:sans` and `system:sans-bold`; use file paths for portable typography. Branding textStyles can supply font, size, color, align and lineSpacing. Elements override style fields. Colours use Pillow-supported colour strings, usually `#RRGGBB` or `#RRGGBBAA`, or `$colors.name` for a branding palette entry.

## Elements

All element IDs are unique within a scene, including nested group children. Types: image, text, shape, path, group, video. Elements default to layer 0. Higher layers draw later; ties retain declaration order. Groups render children relative to a local canvas, then transform that canvas. Set group width/height when the local canvas differs from the project canvas. Content outside it is clipped.

Transforms default to position [0,0], anchor [0,0], scale [1,1], rotation 0 and opacity 1. Anchors are normalized against the element's unmodified local surface dimensions. Positive rotation is clockwise. Glow/shadow padding does not move the anchor. For a circle that follows a route use anchor [0.5,0.5]. Images default to native dimensions. One explicit width/height preserves aspect ratio; both dimensions use contain, cover or stretch fitting.

Text wraps on words when width is supplied. Shape types are circle, ellipse and rectangle, with optional fill, stroke, strokeWidth and cornerRadius. Paths accept a path asset ID, a shared timeline path ID, inline points, or `segments` for multiple polylines. Stroke defaults to white, width 2.

Visibility start/end are global seconds; missing values use the enclosing clip bounds. Ends are exclusive. A video starts at max(clip.start, visibility.start), reads from trimStart and advances by playbackSpeed. At source EOF the last valid video frame is held. Video audio must be explicitly scheduled as an audio track.

## Clips and tracks

Clips require id, scene, start and duration. Clips are composited by layer; overlapping clips are allowed. Tracks target `clip-id/element-id`. A keyframe track requires property and keyframes; a preset track requires animation, start and duration. Do not mix the two forms.

Keyframe times are project-global and strictly increasing. The easing on the destination keyframe controls the preceding segment. Numeric values, equal-length vectors and hex colours interpolate; other strings hold until the destination. Supported properties are position, scale, rotation, opacity, fill, stroke, strokeWidth, reveal, textReveal and `effects.N.radius/intensity/color` (zero-based effect index).

Before/after defaults are holdFirst/holdLast. Use `base` to leave the element's configured value untouched outside the track interval. Sequential tracks on the same property are allowed: the most recently started track controls held values in gaps; prior tracks yield when the next begins. Overlapping active writes to the same target/property are rejected, including implicit preset writes.

Repeat is an integer number of additional plays, default 0. At the final end the terminal value is held. Property-keyframe tracks do not repeat in v1; repeat only applies to named animations. Constant path speed uses arc length; a nonlinear easing intentionally changes speed over time. Cubic Bezier paths require 4, 7, 10... control points and use a sampled length approximation.

## Audio

Audio tracks require id, asset, start and duration; optional trimStart, volume, fadeIn and fadeOut. Audio/video assets are accepted as sources. Input audio is trimmed, delayed to its project start, mixed without automatic normalization, padded and trimmed to the project duration. Excessive combined volume can clip; choose track volumes accordingly.
