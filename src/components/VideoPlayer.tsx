"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { FootageSurrogate } from "./FootageSurrogate";
import type { Reel } from "@/domain/types";

// Imperative handle the screening room uses to drive the player from the
// keyboard transport. We expose only what's needed — no leaking the underlying
// element — so swapping <video> later for a custom decoder is a small change.

export interface VideoPlayerHandle {
  play(): void;
  pause(): void;
  seek(ms: number): void;
  setRate(r: number): void;
  setVolume(v: number): void;
  setMuted(m: boolean): void;
}

interface Props {
  src?: string;
  reel: Reel;
  currentMs: number;
  durationMs: number;
  playing: boolean;
  rate: number;
  volume: number;
  muted: boolean;
  reduceMotion: boolean;
  onTimeUpdate: (ms: number) => void;
  onEnded: () => void;
  onLoadedMetadata?: (durationMs: number) => void;
  onError?: (msg: string) => void;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(function VideoPlayer(
  { src, reel, currentMs, durationMs, playing, rate, volume, muted, reduceMotion, onTimeUpdate, onEnded, onLoadedMetadata, onError },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useImperativeHandle(ref, () => ({
    play() {
      const v = videoRef.current;
      if (v) void v.play().catch(() => {});
    },
    pause() {
      videoRef.current?.pause();
    },
    seek(ms: number) {
      const v = videoRef.current;
      if (v) v.currentTime = ms / 1000;
    },
    setRate(r: number) {
      const v = videoRef.current;
      if (v) {
        try {
          v.playbackRate = r === 0 ? 0.0001 : r > 0 ? r : 1;
          // HTML5 video does not natively reverse — we'll keep playback paused
          // on negative rates and let the rAF loop (in ScreeningRoom) drive
          // the playhead backwards through seek().
        } catch {
          /* ignore */
        }
      }
    },
    setVolume(v: number) {
      const el = videoRef.current;
      if (el) el.volume = Math.max(0, Math.min(1, v));
    },
    setMuted(m: boolean) {
      const el = videoRef.current;
      if (el) el.muted = m;
    },
  }), []);

  if (!src) {
    return (
      <FootageSurrogate
        palette={reel.posterPalette}
        label={reel.label}
        shotOn={reel.shotOn}
        currentMs={currentMs}
        durationMs={durationMs}
        playing={playing && rate !== 0}
        reduceMotion={reduceMotion}
      />
    );
  }

  return (
    <video
      ref={videoRef}
      src={src}
      className="h-full w-full bg-black object-contain"
      preload="metadata"
      playsInline
      controls={false}
      onTimeUpdate={(e) => onTimeUpdate(Math.round(e.currentTarget.currentTime * 1000))}
      onEnded={onEnded}
      onLoadedMetadata={(e) => {
        const dur = Math.round(e.currentTarget.duration * 1000);
        if (Number.isFinite(dur) && dur > 0) onLoadedMetadata?.(dur);
        e.currentTarget.volume = volume;
        e.currentTarget.muted = muted;
      }}
      onError={() => onError?.("video failed to load")}
    />
  );
});
