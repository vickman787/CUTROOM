"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FrameThumb } from "@/components/FrameThumb";
import { removeSelect, useProject } from "@/lib/project-store";
import { formatTcShort } from "@/lib/time";
import type { Project, Select } from "@/domain/types";

// Selects Bench — long horizontal benches with transcript-strip cards.
// Each card carries thumbnail, speaker, the quote (serif), the source reel,
// in/out timecode, and a small note line that can be edited inline.

export function SelectsBenchClient({
  slug,
  fallbackProject,
}: {
  slug: string;
  fallbackProject: Project;
}) {
  const live = useProject(slug);
  const project = live ?? fallbackProject;
  const [filter, setFilter] = useState<string>("all");
  const [order, setOrder] = useState<"created" | "reel" | "duration">("created");

  const visible = useMemo(() => {
    const arr = project.selects.filter((s) =>
      filter === "all" ? true : s.reelId === filter,
    );
    if (order === "reel") arr.sort((a, b) => a.reelId.localeCompare(b.reelId) || a.inMs - b.inMs);
    if (order === "duration") arr.sort((a, b) => b.outMs - b.inMs - (a.outMs - a.inMs));
    if (order === "created") arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return arr;
  }, [project.selects, filter, order]);

  const speakerName = (id: string) =>
    project.reels.flatMap((r) => r.analysis.speakers).find((s) => s.id === id)?.name ?? id;

  return (
    <main className="mx-auto max-w-[1600px] px-8 py-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="font-grotesk text-[11px] uppercase tracking-wider text-ink/65">SELECTS</p>
          <h1 className="mt-1 font-serif text-[36px] leading-none tracking-tight">Selects Bench</h1>
        </div>
        <div className="flex items-center gap-3 font-grotesk text-[11px] uppercase tracking-wider">
          <label>
            Reel
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="ml-2 border border-ink bg-paper px-2 py-1 uppercase"
            >
              <option value="all">All</option>
              {project.reels.map((r) => (
                <option key={r.id} value={r.id}>
                  R{r.number.toString().padStart(2, "0")} · {r.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Order
            <select
              value={order}
              onChange={(e) => setOrder(e.target.value as typeof order)}
              className="ml-2 border border-ink bg-paper px-2 py-1 uppercase"
            >
              <option value="created">Saved</option>
              <option value="reel">Reel · TC</option>
              <option value="duration">Duration</option>
            </select>
          </label>
        </div>
      </div>

      <p className="mb-8 max-w-[640px] font-serif text-[14px] leading-snug text-ink/80">
        {visible.length === 0
          ? "No selects yet. Mark IN and OUT in the screening room and press S — or save Claude's suggestions from the analysis column."
          : `${visible.length} excerpt${visible.length === 1 ? "" : "s"} on the bench. Drag the title bar to reorder; drop one on the paper-edit page to place it.`}
      </p>

      <div className="space-y-10">
        {groupBenches(visible).map((bench, i) => (
          <Bench
            key={i}
            title={`Bench ${String.fromCharCode(65 + i)}`}
            selects={bench}
            project={project}
            slug={slug}
            speakerName={speakerName}
          />
        ))}
      </div>
    </main>
  );
}

function groupBenches(selects: Select[]): Select[][] {
  const benches: Select[][] = [];
  const perBench = 8;
  for (let i = 0; i < selects.length; i += perBench) {
    benches.push(selects.slice(i, i + perBench));
  }
  if (benches.length === 0) benches.push([]);
  return benches;
}

function Bench({
  title,
  selects,
  project,
  slug,
  speakerName,
}: {
  title: string;
  selects: Select[];
  project: Project;
  slug: string;
  speakerName: (id: string) => string;
}) {
  return (
    <section>
      <header className="mb-3 flex items-end justify-between border-b border-ink/40 pb-2">
        <h2 className="font-grotesk text-[14px] uppercase tracking-wider text-ink">{title}</h2>
        <span className="font-grotesk text-[10px] uppercase tracking-wider text-ink/70">{selects.length} strips</span>
      </header>
      {selects.length === 0 ? (
        <div className="flex h-32 items-center justify-center border border-dashed border-ink/40 bg-paper-warm font-grotesk text-[11px] uppercase tracking-wider text-ink/55">
          empty bench
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2">
          {selects.map((s, i) => {
            const reel = project.reels.find((r) => r.id === s.reelId)!;
            return (
              <li
                key={s.id}
                className="relative border border-ink bg-paper-warm crop-frame"
                style={{ transform: `rotate(${((i % 5) - 2) * 0.18}deg)` }}
              >
                <span className="crop-bl" />
                <span className="crop-br" />
                <div className="flex items-stretch">
                  <div className="shrink-0 border-r border-ink/60 bg-ink p-2">
                    <FrameThumb reel={reel} atMs={s.inMs} size="sm" withSprockets />
                  </div>
                  <div className="flex flex-1 flex-col">
                    <header
                      className="flex cursor-grab items-center justify-between border-b border-ink/60 bg-ink px-3 py-1 font-grotesk text-[10px] uppercase tracking-wider text-paper"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/x-cutroom-select", s.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                    >
                      <span>R{reel.number.toString().padStart(2, "0")} · {reel.label}</span>
                      <span>{formatTcShort(s.inMs)} — {formatTcShort(s.outMs)}</span>
                    </header>
                    <div className="flex-1 px-3 py-2">
                      <div className="font-grotesk text-[10px] uppercase tracking-wider text-ink/65">
                        {speakerName(s.speakerId)}
                      </div>
                      <p className="mt-1 font-serif text-[15px] italic leading-snug">&ldquo;{s.quote}&rdquo;</p>
                      {s.notes && (
                        <p className="mt-2 border-l-2 border-vermilion pl-2 font-serif text-[12px] text-ink/75">
                          {s.notes}
                        </p>
                      )}
                    </div>
                    <footer className="flex items-center justify-between border-t border-ink/20 px-3 py-1 font-grotesk text-[10px] uppercase tracking-wider text-ink/65">
                      <Link
                        href={`/projects/${slug}/screening/${reel.id}?select=${encodeURIComponent(s.id)}&in=${s.inMs}&out=${s.outMs}`}
                        className="hover:text-vermilion hover:underline"
                      >
                        Open in screening room →
                      </Link>
                      <span className="flex items-center gap-3">
                        <span>{formatTcShort(s.outMs - s.inMs)} on screen</span>
                        <button
                          type="button"
                          onClick={() => void removeSelect(slug, s.id)}
                          className="border border-ink/40 px-2 py-0.5 hover:bg-vermilion hover:text-paper hover:border-vermilion"
                        >
                          discard
                        </button>
                      </span>
                    </footer>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
