import { useEffect, useState } from "react";
import { Play, Pause, SkipBack, Repeat2 } from "lucide-react";
import { useBuilder } from "../viewmodels/BuilderContext";
import { formatTime } from "./Fields";

export function Transport() {
  const vm = useBuilder(),
    [playing, setPlaying] = useState(false),
    [loop, setLoop] = useState(true);
  const duration = vm.project?.timeline.duration ?? 1,
    fps = vm.project?.timeline.fps ?? 24;
  useEffect(() => {
    if (!playing) return;
    let handle = 0,
      previous = -1;
    const started = performance.now(),
      origin = vm.time;
    const tick = (now: number) => {
      let value = origin + (now - started) / 1000;
      if (value >= duration) {
        if (loop) value %= duration;
        else {
          vm.setTime(Math.max(0, duration - 1 / fps));
          setPlaying(false);
          return;
        }
      }
      const frame = Math.floor(value * fps);
      if (frame !== previous) {
        vm.setTime(frame / fps);
        previous = frame;
      }
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [playing, duration, fps, loop]);
  return (
    <div className="transport">
      <div className="transport-buttons">
        <button
          className="icon-button"
          aria-label="Back to start"
          onClick={() => {
            setPlaying(false);
            vm.setTime(0);
          }}
        >
          <SkipBack size={16} />
        </button>
        <button
          className="play-button"
          aria-label={playing ? "Pause preview" : "Play preview"}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? (
            <Pause size={16} />
          ) : (
            <Play size={16} fill="currentColor" />
          )}
        </button>
        <button
          className={`icon-button ${loop ? "active" : ""}`}
          aria-label="Loop preview"
          aria-pressed={loop}
          onClick={() => setLoop(!loop)}
        >
          <Repeat2 size={17} />
        </button>
      </div>
      <span className="time-code">{formatTime(vm.time, fps)}</span>
      <input
        aria-label="Preview time"
        type="range"
        min={0}
        max={Math.max(0, duration - 1 / fps)}
        step={1 / fps}
        value={Math.min(vm.time, duration - 1 / fps)}
        onChange={(event) => {
          setPlaying(false);
          vm.setTime(+event.target.value);
        }}
      />
      <span className="time-code muted">{formatTime(duration, fps)}</span>
      <span className="transport-fps">{fps} fps</span>
    </div>
  );
}
