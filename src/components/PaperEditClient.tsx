"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FrameThumb } from "@/components/FrameThumb";
import { removeSelect, replacePaperEdit, useProject } from "@/lib/project-store";
import { formatTcShort } from "@/lib/time";
import type { Act, PaperEditEntry, Project, Select } from "@/domain/types";

// Paper Edit — a long horizontal worktable, three acts stacked vertically.
// Each act is a row of excerpt strips that can be reordered by drag, moved
// between acts, dropped in from the Selects Bench (via the global window
// dataTransfer "application/x-cutroom-select"), and removed.

export function PaperEditClient({
  slug,
  fallbackProject,
}: {
  slug: string;
  fallbackProject: Project;
}) {
  const live = useProject(slug);
  const project = live ?? fallbackProject;

  const [drag, setDrag] = useState<
    | { kind: "entry"; entryId: string }
    | { kind: "select"; selectId: string }
    | null
  >(null);

  const byAct = useMemo(() => {
    const m: Record<Act, PaperEditEntry[]> = { 1: [], 2: [], 3: [] };
    for (const e of [...project.paperEdit].sort((a, b) => a.position - b.position)) {
      m[e.act].push(e);
    }
    return m;
  }, [project.paperEdit]);

  const availableSelects = project.selects.filter(
    (s) => !project.paperEdit.some((e) => e.selectId === s.id),
  );

  const handleDrop = async (act: Act, position: number) => {
    const next: PaperEditEntry[] = [];
    (Object.keys(byAct) as unknown as Act[]).forEach((a) => {
      for (const e of byAct[a]) next.push(e);
    });
    let working = next.slice();

    if (drag?.kind === "entry") {
      const entry = working.find((e) => e.id === drag.entryId);
      if (!entry) {
        setDrag(null);
        return;
      }
      working = working.filter((e) => e.id !== entry.id);
      const before = working.filter((e) => e.act < act).length;
      const within = working.filter((e) => e.act === act);
      const insertAt = before + Math.min(position, within.length);
      const updated: PaperEditEntry = { ...entry, act };
      working.splice(insertAt, 0, updated);
    } else if (drag?.kind === "select") {
      const sel = project.selects.find((s) => s.id === drag.selectId);
      if (!sel) {
        setDrag(null);
        return;
      }
      const before = working.filter((e) => e.act < act).length;
      const within = working.filter((e) => e.act === act);
      const insertAt = before + Math.min(position, within.length);
      const newEntry: PaperEditEntry = {
        id: `pe_${Math.random().toString(36).slice(2, 9)}`,
        projectId: project.id,
        selectId: sel.id,
        act,
        position: 0,
        beat: "",
      };
      working.splice(insertAt, 0, newEntry);
    }
    // re-number positions per act
    const perAct: Record<Act, number> = { 1: 0, 2: 0, 3: 0 };
    working = working.map((e) => {
      const p = perAct[e.act]++;
      return { ...e, position: p };
    });
    await replacePaperEdit(slug, working);
    setDrag(null);
  };

  const handleRemove = async (entryId: string) => {
    const next = project.paperEdit.filter((e) => e.id !== entryId);
    await replacePaperEdit(slug, next);
  };

  const handleDiscardSelect = async (selectId: string) => {
    await removeSelect(slug, selectId);
  };

  const handleAddAllToActOne = async () => {
    if (availableSelects.length === 0) return;
    const existing = project.paperEdit.slice();
    const start = existing.filter((e) => e.act === 1).length;
    const orderedSelects = availableSelects.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const added = orderedSelects.map((sel, i): PaperEditEntry => ({
      id: `pe_${Math.random().toString(36).slice(2, 9)}_${i}`,
      projectId: project.id,
      selectId: sel.id,
      act: 1,
      position: start + i,
      beat: "",
    }));
    await replacePaperEdit(slug, renumberPaperEdit([...existing, ...added]));
  };

  const speakerName = (id: string) =>
    project.reels.flatMap((r) => r.analysis.speakers).find((s) => s.id === id)?.name ?? id;

  const totalForAct = (a: Act) =>
    byAct[a].reduce((acc, e) => {
      const sel = project.selects.find((s) => s.id === e.selectId);
      return acc + (sel ? sel.outMs - sel.inMs : 0);
    }, 0);

  return (
    <main className="mx-auto max-w-[1600px] px-8 py-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="font-grotesk text-[11px] uppercase tracking-wider text-ink/65">EDIT · v0.3</p>
          <h1 className="mt-1 font-serif text-[36px] leading-none tracking-tight">Paper Edit</h1>
        </div>
        <div className="text-right font-grotesk text-[11px] uppercase tracking-wider text-ink/70">
          <div>
            Running time · {formatTcShort(totalForAct(1) + totalForAct(2) + totalForAct(3))}
          </div>
          <div className="mt-0.5">
            I {formatTcShort(totalForAct(1))} · II {formatTcShort(totalForAct(2))} · III {formatTcShort(totalForAct(3))}
          </div>
        </div>
      </div>

      <div className="mb-5 flex justify-end">
        <Link
          href={`/projects/${slug}/paper-edit/play`}
          className="border border-ink bg-paper px-3 py-1.5 font-grotesk text-[10px] uppercase tracking-wider text-ink hover:bg-ink hover:text-paper"
        >
          Play paper edit
        </Link>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-6">
        <div className="space-y-6 worktable border border-ink/30 p-5">
          {([1, 2, 3] as Act[]).map((a) => (
            <ActBand
              key={a}
              act={a}
              entries={byAct[a]}
              project={project}
              speakerName={speakerName}
              onDragStart={(entryId) => setDrag({ kind: "entry", entryId })}
              onDropAt={(pos) => handleDrop(a, pos)}
              onRemove={handleRemove}
              onDiscardSelect={handleDiscardSelect}
              onBeatChange={async (entryId, beat) => {
                const next = project.paperEdit.map((e) =>
                  e.id === entryId ? { ...e, beat } : e,
                );
                await replacePaperEdit(slug, next);
              }}
            />
          ))}
        </div>

        <aside className="sticky top-[120px] h-fit border border-ink/40 bg-paper p-4">
          <h2 className="font-grotesk text-[11px] uppercase tracking-wider text-ink/70">Unplaced selects</h2>
          <p className="mt-1 font-serif text-[12px] italic text-ink/70">
            Drag a strip into an act. Drop between strips to position it.
          </p>
          {availableSelects.length > 0 && (
            <button
              type="button"
              onClick={() => void handleAddAllToActOne()}
              className="mt-3 w-full border border-ink bg-paper px-3 py-1.5 font-grotesk text-[10px] uppercase tracking-wider hover:bg-ink hover:text-paper"
            >
              Add all to Act I
            </button>
          )}
          <ul className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {availableSelects.length === 0 && (
              <li className="border border-dashed border-ink/30 p-3 font-grotesk text-[10px] uppercase tracking-wider text-ink/55">
                Bench is clear. Every select is on the worktable.
              </li>
            )}
            {availableSelects.map((s) => (
              <UnplacedSelect
                key={s.id}
                s={s}
                project={project}
                speakerName={speakerName}
                onDragStart={() => setDrag({ kind: "select", selectId: s.id })}
                onDiscard={() => void handleDiscardSelect(s.id)}
              />
            ))}
          </ul>
        </aside>
      </div>
    </main>
  );
}

function ActBand({
  act,
  entries,
  project,
  speakerName,
  onDragStart,
  onDropAt,
  onRemove,
  onDiscardSelect,
  onBeatChange,
}: {
  act: Act;
  entries: PaperEditEntry[];
  project: Project;
  speakerName: (id: string) => string;
  onDragStart: (entryId: string) => void;
  onDropAt: (position: number) => void;
  onRemove: (entryId: string) => void;
  onDiscardSelect: (selectId: string) => void;
  onBeatChange: (entryId: string, beat: string) => void;
}) {
  return (
    <section className="border border-ink bg-paper-warm">
      <header className="flex items-end justify-between border-b border-ink/40 px-4 py-2">
        <div>
          <p className="font-grotesk text-[10px] uppercase tracking-wider text-ink/65">Act {romanise(act)}</p>
          <h3 className="font-serif text-[20px] leading-none">
            {act === 1 ? "Set up the room." : act === 2 ? "Pressure the room." : "Empty the room."}
          </h3>
        </div>
        <span className="font-grotesk text-[10px] uppercase tracking-wider text-ink/65">
          {entries.length} strips
        </span>
      </header>

      <div className="flex gap-0 overflow-x-auto p-4">
        <DropZone onDrop={() => onDropAt(0)} />
        {entries.map((e, i) => {
          const sel = project.selects.find((s) => s.id === e.selectId);
          if (!sel) return null;
          const reel = project.reels.find((r) => r.id === sel.reelId)!;
          return (
            <div key={e.id} className="flex items-stretch">
              <article
                draggable
                onDragStart={(ev) => {
                  ev.dataTransfer.setData("application/x-cutroom-entry", e.id);
                  ev.dataTransfer.effectAllowed = "move";
                  onDragStart(e.id);
                }}
                className="relative flex w-[280px] shrink-0 cursor-grab flex-col border border-ink bg-paper crop-frame"
                style={{ transform: `rotate(${((i % 5) - 2) * 0.25}deg)` }}
              >
                <span className="crop-bl" />
                <span className="crop-br" />
                <header className="flex items-center justify-between border-b border-ink/60 bg-ink px-2 py-1 font-grotesk text-[10px] uppercase tracking-wider text-paper">
                  <span>
                    {romanise(act)}·{(i + 1).toString().padStart(2, "0")} — R{reel.number.toString().padStart(2, "0")}
                  </span>
                  <span>{formatTcShort(sel.outMs - sel.inMs)}</span>
                </header>
                <div className="flex items-stretch">
                  <div className="border-r border-ink/40 bg-ink p-1.5">
                    <FrameThumb reel={reel} atMs={sel.inMs} size="sm" />
                  </div>
                  <div className="flex-1 px-2 py-1.5">
                    <div className="font-grotesk text-[10px] uppercase tracking-wider text-ink/65">
                      {speakerName(sel.speakerId)}
                    </div>
                    <p className="mt-1 line-clamp-3 font-serif text-[12px] italic leading-snug">&ldquo;{sel.quote}&rdquo;</p>
                  </div>
                </div>
                <textarea
                  defaultValue={e.beat}
                  placeholder="Beat note (why this is here)"
                  className="m-2 mt-0 h-12 resize-none border border-ink/30 bg-paper-warm p-1 font-serif text-[12px] leading-snug focus:border-ink"
                  onBlur={(ev) => {
                    if (ev.currentTarget.value !== e.beat) onBeatChange(e.id, ev.currentTarget.value);
                  }}
                />
                <footer className="flex items-center justify-between border-t border-ink/20 px-2 py-1 font-grotesk text-[10px] uppercase tracking-wider text-ink/65">
                  <span>{formatTcShort(sel.inMs)} — {formatTcShort(sel.outMs)}</span>
                  <span className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => onRemove(e.id)}
                      className="border border-ink/40 px-2 py-0.5 hover:bg-ink hover:text-paper"
                    >
                      lift
                    </button>
                    <button
                      type="button"
                      onClick={() => onDiscardSelect(sel.id)}
                      className="border border-vermilion/70 px-2 py-0.5 text-vermilion hover:bg-vermilion hover:text-paper"
                    >
                      discard
                    </button>
                  </span>
                </footer>
              </article>
              <DropZone onDrop={() => onDropAt(i + 1)} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function UnplacedSelect({
  s,
  project,
  speakerName,
  onDragStart,
  onDiscard,
}: {
  s: Select;
  project: Project;
  speakerName: (id: string) => string;
  onDragStart: () => void;
  onDiscard: () => void;
}) {
  const reel = project.reels.find((r) => r.id === s.reelId)!;
  return (
    <li
      draggable
      onDragStart={(ev) => {
        ev.dataTransfer.setData("application/x-cutroom-select", s.id);
        ev.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      className="flex cursor-grab items-stretch border border-ink/60 bg-paper-warm hover:border-ink"
    >
      <div className="border-r border-ink/40 bg-ink p-1">
        <FrameThumb reel={reel} atMs={s.inMs} size="sm" />
      </div>
      <div className="flex-1 p-2">
        <div className="flex items-center justify-between font-grotesk text-[10px] uppercase tracking-wider text-ink/65">
          <span>R{reel.number.toString().padStart(2, "0")}</span>
          <span>{formatTcShort(s.outMs - s.inMs)}</span>
        </div>
        <div className="mt-0.5 font-grotesk text-[10px] uppercase tracking-wider text-ink/70">
          {speakerName(s.speakerId)}
        </div>
        <p className="mt-1 line-clamp-2 font-serif text-[12px] italic leading-snug">&ldquo;{s.quote}&rdquo;</p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDiscard();
          }}
          className="mt-2 border border-vermilion/70 px-2 py-0.5 font-grotesk text-[10px] uppercase tracking-wider text-vermilion hover:bg-vermilion hover:text-paper"
        >
          discard
        </button>
      </div>
    </li>
  );
}

function DropZone({ onDrop }: { onDrop: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        onDrop();
      }}
      className={
        hover
          ? "w-8 shrink-0 border-l-2 border-r-2 border-vermilion bg-vermilion/15"
          : "w-3 shrink-0 border-l border-r border-transparent"
      }
      aria-label="Drop here"
    />
  );
}

function romanise(act: Act): string {
  return act === 1 ? "I" : act === 2 ? "II" : "III";
}

function renumberPaperEdit(entries: PaperEditEntry[]) {
  const counters: Record<Act, number> = { 1: 0, 2: 0, 3: 0 };
  return entries
    .slice()
    .sort((a, b) => a.act - b.act || a.position - b.position)
    .map((entry) => ({ ...entry, position: counters[entry.act]++ }));
}
