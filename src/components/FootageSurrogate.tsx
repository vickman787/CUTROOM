"use client";

import { useEffect, useRef, useState } from "react";

// FootageSurrogate: a CSS-painted placeholder for footage in mock mode.
// It animates a slowly moving "frame" (panning gradient + grain) and overlays
// a timecode + speaker so the screening room still has motion to watch.
//
// When a real Shelby URL is resolved, replace with <video> in the parent.

export function FootageSurrogate({
  palette,
  label,
  shotOn,
  currentMs,
  durationMs,
  playing,
  reduceMotion,
}: {
  palette: [string, string, string];
  label: string;
  shotOn: string;
  currentMs: number;
  durationMs: number;
  playing: boolean;
  reduceMotion: boolean;
}) {
  const pct = Math.max(0, Math.min(1, currentMs / Math.max(1, durationMs)));
  const ref = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 50, y: 50 });

  // Slow Ken-Burns over the painted frame so the surface visibly breathes.
  useEffect(() => {
    if (!playing || reduceMotion) return;
    let raf = 0;
    const tick = (t: number) => {
      setPan({
        x: 50 + Math.sin(t / 4000) * 8,
        y: 50 + Math.cos(t / 5200) * 6,
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, reduceMotion]);

  return (
    <div
      ref={ref}
      className="relative h-full w-full overflow-hidden bg-black grain projector"
      role="img"
      aria-label={`Footage frame for ${label}`}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(ellipse 90% 70% at ${pan.x}% ${pan.y}%, ${palette[2]}aa, ${palette[1]}66 35%, ${palette[0]} 80%)`,
          transition: "background-position 200ms linear",
        }}
      />
      {/* subtle vignette */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 50%, transparent 50%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      {/* edge sprocket bars — kept tiny so they feel like film, not chrome */}
      <div aria-hidden className="absolute inset-y-0 left-0 w-3 sprocket-strip-v opacity-70" />
      <div aria-hidden className="absolute inset-y-0 right-0 w-3 sprocket-strip-v opacity-70" />
      {/* footage overlay info */}
      <div className="pointer-events-none absolute left-5 top-4 font-grotesk text-[10px] uppercase tracking-wider text-paper/90">
        <div>{shotOn}</div>
        <div className="mt-1 opacity-80">{label}</div>
      </div>
      <div className="pointer-events-none absolute right-5 top-4 font-grotesk text-[10px] uppercase tracking-wider text-paper/90">
        REC · {(pct * 100).toFixed(1)}% ·{" "}
        <span className="text-vermilion">{playing ? "PLAY" : "HOLD"}</span>
      </div>
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 font-grotesk text-[11px] uppercase tracking-wider text-paper/85">
        — mock frame · supply footage to replace —
      </div>
    </div>
  );
}
