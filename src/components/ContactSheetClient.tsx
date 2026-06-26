"use client";

import { useState } from "react";
import { FrameThumb } from "@/components/FrameThumb";
import { saveSelect, useProject } from "@/lib/project-store";
import { formatTcShort } from "@/lib/time";
import type { Project, Reel } from "@/domain/types";

// Contact sheet — imperfect rows of small frames. Click marks (grease pencil),
// click again unmarks. Marked frames can be saved as 6-second selects centered
// on the chosen moment.

const SAMPLES_PER_REEL = 18;

export function ContactSheetClient({
  slug,
  fallbackProject,
}: {
  slug: string;
  fallbackProject: Project;
}) {
  const live = useProject(slug);
  const project = live ?? fallbackProject;
  const [marked, setMarked] = useState<Record<string, true>>({});

  const toggle = (key: string) => {
    setMarked((m) => {
      const next = { ...m };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  };

  const saveAllMarked = async () => {
    const keys = Object.keys(marked);
    for (const key of keys) {
      const [reelId, msStr] = key.split("@");
      const ms = parseInt(msStr, 10);
      const reel = project.reels.find((r) => r.id === reelId);
      if (!reel) continue;
      const seg = reel.analysis.segments.find((s) => s.startMs <= ms && s.endMs >= ms);
      const span = 6000;
      await saveSelect(slug, {
        id: `sel_${Math.random().toString(36).slice(2, 9)}`,
        projectId: project.id,
        reelId,
        inMs: Math.max(0, ms - span / 2),
        outMs: Math.min(reel.durationMs, ms + span / 2),
        speakerId: seg?.speakerId ?? reel.analysis.speakers[0]?.id ?? "spk_unknown",
        quote: (seg?.text ?? "").slice(0, 220),
        notes: "Marked on contact sheet.",
        createdAt: new Date().toISOString(),
      });
    }
    setMarked({});
  };

  return (
    <main className="mx-auto max-w-[1600px] px-8 py-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="font-grotesk text-[11px] uppercase tracking-wider text-ink/65">PROOF · contact</p>
          <h1 className="mt-1 font-serif text-[36px] leading-none tracking-tight">Contact Sheet</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-grotesk text-[11px] uppercase tracking-wider text-ink/70">
            {Object.keys(marked).length} marked
          </span>
          <button
            type="button"
            onClick={saveAllMarked}
            disabled={Object.keys(marked).length === 0}
            className="border border-ink bg-ink px-3 py-1.5 font-grotesk text-[11px] uppercase tracking-wider text-paper hover:bg-vermilion hover:border-vermilion disabled:opacity-40"
          >
            Save marked as selects (6s each)
          </button>
        </div>
      </div>

      <div className="space-y-10">
        {project.reels.map((reel) => (
          <ReelSheet
            key={reel.id}
            reel={reel}
            marked={marked}
            onToggle={(ms) => toggle(`${reel.id}@${ms}`)}
          />
        ))}
      </div>
    </main>
  );
}

function ReelSheet({
  reel,
  marked,
  onToggle,
}: {
  reel: Reel;
  marked: Record<string, true>;
  onToggle: (ms: number) => void;
}) {
  const samples = Array.from({ length: SAMPLES_PER_REEL }).map((_, i) =>
    Math.round(((i + 0.5) / SAMPLES_PER_REEL) * reel.durationMs),
  );
  // slight per-row rotation, like film strips clipped to a board.
  return (
    <section>
      <header className="mb-3 flex items-end justify-between border-b border-ink/40 pb-2">
        <div>
          <p className="font-grotesk text-[10px] uppercase tracking-wider text-ink/65">
            REEL {reel.number.toString().padStart(2, "0")} · {reel.shotOn}
          </p>
          <h2 className="font-serif text-[22px]">{reel.label}</h2>
        </div>
        <div className="tape tape-rip rotate-[-1.5deg] px-4 py-1 text-[10px]">
          PROOF · DAILIES
        </div>
      </header>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9">
        {samples.map((ms, i) => {
          const key = `${reel.id}@${ms}`;
          const isMarked = !!marked[key];
          const seg = reel.analysis.segments.find((s) => s.startMs <= ms && s.endMs >= ms);
          const speaker = seg ? reel.analysis.speakers.find((sp) => sp.id === seg.speakerId)?.name : undefined;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggle(ms)}
              className="group relative block text-left"
              style={{ transform: `rotate(${((i % 3) - 1) * 0.4}deg)` }}
              aria-pressed={isMarked}
            >
              <FrameThumb
                reel={reel}
                atMs={ms}
                size="sm"
                withSprockets
                label={speaker?.split(" ")[0]}
              />
              <div className="mt-1 flex justify-between font-grotesk text-[9px] uppercase tracking-wider text-ink/65">
                <span>{(i + 1).toString().padStart(2, "0")}</span>
                <span>{formatTcShort(ms)}</span>
              </div>
              {isMarked && <span aria-hidden className="grease-mark" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
