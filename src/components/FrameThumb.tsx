"use client";

// Generates a deterministic "frame" — a CSS painting of a moment in a reel.
// Used as a thumbnail in the contact sheet and on transcript-strip selects.

import type { Reel } from "@/domain/types";

export function FrameThumb({
  reel,
  atMs,
  size = "md",
  withSprockets = false,
  label,
}: {
  reel: Reel;
  atMs: number;
  size?: "sm" | "md" | "lg";
  withSprockets?: boolean;
  label?: string;
}) {
  const dim = size === "sm" ? 96 : size === "lg" ? 220 : 144;
  const t = (atMs / Math.max(1, reel.durationMs));
  const palette = reel.posterPalette;
  // Make each "frame" slightly different by warping the radial center.
  const cx = 30 + Math.sin(t * 9.7 + reel.number) * 36;
  const cy = 30 + Math.cos(t * 7.3 + reel.number) * 32;
  const hue = palette[Math.floor((t * 3) % 3)];
  return (
    <div
      className="relative inline-block grain"
      style={{
        width: dim,
        height: dim * (9 / 16) * 1.6, // 4:3-ish frame
      }}
    >
      {withSprockets && (
        <>
          <div aria-hidden className="absolute left-0 top-0 h-full w-2 sprocket-strip-v opacity-70" />
          <div aria-hidden className="absolute right-0 top-0 h-full w-2 sprocket-strip-v opacity-70" />
        </>
      )}
      <div
        className="absolute inset-0 border border-ink/70"
        style={{
          background: `radial-gradient(ellipse 70% 60% at ${cx}% ${cy}%, ${hue}cc, ${palette[1]}66 38%, ${palette[0]} 82%)`,
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 50%, transparent 55%, rgba(0,0,0,0.6) 100%)",
        }}
      />
      {label && (
        <div className="absolute bottom-1 left-1 right-1 truncate font-grotesk text-[9px] uppercase tracking-wider text-paper/85">
          {label}
        </div>
      )}
    </div>
  );
}
