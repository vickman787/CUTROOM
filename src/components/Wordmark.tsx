// CUTROOM wordmark. "CUT" sits inside a black film cell with a vermilion
// splice diagonal cutting through it; "ROOM" trails out into the paper like a
// piece of leader tape. Designed for editorial intent — not a copy of any
// other brand mark.

type Size = "sm" | "md" | "lg" | "xl";

const SIZE: Record<Size, { h: number; track: string }> = {
  sm: { h: 22, track: "0.18em" },
  md: { h: 38, track: "0.22em" },
  lg: { h: 64, track: "0.28em" },
  xl: { h: 112, track: "0.34em" },
};

export function Wordmark({
  size = "md",
  invert = false,
}: {
  size?: Size;
  invert?: boolean;
}) {
  const s = SIZE[size];
  const ink = invert ? "var(--paper)" : "var(--ink)";
  const paper = invert ? "var(--ink)" : "var(--paper)";
  const cellW = s.h * 1.66;
  return (
    <span
      className="inline-flex items-stretch font-grotesk select-none"
      style={{ height: s.h, letterSpacing: s.track }}
      aria-label="CUTROOM"
    >
      <span
        className="relative flex items-center justify-center"
        style={{
          width: cellW,
          background: ink,
          color: paper,
          fontWeight: 700,
          fontSize: s.h * 0.62,
          lineHeight: 1,
          paddingInline: s.h * 0.18,
        }}
      >
        <span
          aria-hidden
          className="absolute left-0 right-0"
          style={{
            top: 0,
            height: s.h * 0.13,
            background: `repeating-linear-gradient(to right, ${paper} 0 ${s.h * 0.07}px, transparent ${s.h * 0.07}px ${s.h * 0.22}px)`,
            opacity: 0.85,
            maskImage: "linear-gradient(to bottom, black, transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
          }}
        />
        <span
          aria-hidden
          className="absolute left-0 right-0"
          style={{
            bottom: 0,
            height: s.h * 0.13,
            background: `repeating-linear-gradient(to right, ${paper} 0 ${s.h * 0.07}px, transparent ${s.h * 0.07}px ${s.h * 0.22}px)`,
            opacity: 0.85,
            maskImage: "linear-gradient(to top, black, transparent)",
            WebkitMaskImage: "linear-gradient(to top, black, transparent)",
          }}
        />
        <span style={{ position: "relative", zIndex: 1 }}>CUT</span>
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: -s.h * 0.16,
            bottom: -s.h * 0.16,
            left: "62%",
            width: s.h * 0.16,
            background: "var(--vermilion)",
            transform: "rotate(14deg)",
            transformOrigin: "center",
            mixBlendMode: "screen",
            opacity: 0.92,
            zIndex: 2,
          }}
        />
      </span>
      <span
        className="flex items-center"
        style={{
          background: paper,
          color: ink,
          fontWeight: 600,
          fontSize: s.h * 0.62,
          lineHeight: 1,
          paddingInline: s.h * 0.32,
          borderTop: `1px solid ${ink}`,
          borderBottom: `1px solid ${ink}`,
          borderRight: `1px solid ${ink}`,
        }}
      >
        ROOM
      </span>
    </span>
  );
}
