"use client";

import Link from "next/link";
import { useState } from "react";
import { useProject } from "@/lib/project-store";
import { formatTcShort } from "@/lib/time";
import type { Project, TreatmentCitation } from "@/domain/types";

// Treatment — a clean editorial document. Every paragraph closes with a row
// of citation chips. Hovering a chip blooms a preview drawer at the bottom
// of the page; clicking jumps to the screening room at that timecode.

export function TreatmentClient({
  slug,
  fallbackProject,
}: {
  slug: string;
  fallbackProject: Project;
}) {
  const live = useProject(slug);
  const project = live ?? fallbackProject;
  const [preview, setPreview] = useState<TreatmentCitation | null>(null);

  return (
    <main className="mx-auto max-w-[1180px] px-8 py-10">
      <header className="mb-10 border-b border-ink/40 pb-6">
        <p className="font-grotesk text-[11px] uppercase tracking-wider text-ink/65">Treatment · v0.3</p>
        <h1 className="mt-2 font-serif text-[44px] leading-[1.05] tracking-tight">{project.title}</h1>
        <p className="mt-2 font-serif text-[18px] italic text-ink/85">{project.subtitle}</p>
        <div className="mt-6 grid grid-cols-3 gap-6 font-grotesk text-[10px] uppercase tracking-wider text-ink/70">
          <div>
            <div className="text-ink/60">Director</div>
            <div className="mt-0.5 text-ink">{project.director}</div>
          </div>
          <div>
            <div className="text-ink/60">Production</div>
            <div className="mt-0.5 text-ink">{project.productionCompany}</div>
          </div>
          <div>
            <div className="text-ink/60">Shot</div>
            <div className="mt-0.5 text-ink">{project.shotAround}</div>
          </div>
        </div>
      </header>

      <article className="space-y-10 font-serif text-[18px] leading-[1.65] text-ink">
        {project.treatment.paragraphs.map((p) => (
          <section key={p.id}>
            {p.heading && (
              <h2 className="mb-2 font-grotesk text-[12px] uppercase tracking-wider text-ink/70">
                {p.heading}
              </h2>
            )}
            <p>{p.body}</p>
            {p.citations.length > 0 && (
              <ul className="mt-3 flex flex-wrap items-center gap-2">
                <span className="font-grotesk text-[10px] uppercase tracking-wider text-ink/55">
                  Sources
                </span>
                {p.citations.map((c, i) => {
                  const reel = project.reels.find((r) => r.id === c.reelId);
                  if (!reel) return null;
                  return (
                    <li key={`${p.id}-${i}`}>
                      <Link
                        href={`/projects/${slug}/screening/${c.reelId}?t=${c.startMs}`}
                        onMouseEnter={() => setPreview(c)}
                        onFocus={() => setPreview(c)}
                        onMouseLeave={() => setPreview(null)}
                        onBlur={() => setPreview(null)}
                        className="inline-flex items-center gap-2 border border-ink bg-paper-warm px-2 py-1 font-grotesk text-[10px] uppercase tracking-wider hover:bg-ink hover:text-paper"
                      >
                        <span>R{reel.number.toString().padStart(2, "0")}</span>
                        <span>{formatTcShort(c.startMs)} — {formatTcShort(c.endMs)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </article>

      <footer className="mt-16 border-t border-ink/40 pt-4 font-grotesk text-[10px] uppercase tracking-wider text-ink/65">
        Updated {new Date(project.treatment.updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · Every claim above resolves to a source reel.
      </footer>

      <CitationPreview project={project} citation={preview} />
    </main>
  );
}

function CitationPreview({ project, citation }: { project: Project; citation: TreatmentCitation | null }) {
  if (!citation) return null;
  const reel = project.reels.find((r) => r.id === citation.reelId);
  const seg = reel?.analysis.segments.find((s) => s.id === citation.segmentId);
  const speaker = reel?.analysis.speakers.find((sp) => sp.id === seg?.speakerId);
  if (!reel || !seg) return null;
  return (
    <aside className="pointer-events-none fixed bottom-6 left-1/2 z-40 w-[min(880px,90vw)] -translate-x-1/2 border border-ink bg-paper p-4 shadow-[0_18px_36px_rgba(0,0,0,0.18)]">
      <div className="flex items-center justify-between font-grotesk text-[10px] uppercase tracking-wider text-ink/70">
        <span>
          Source · R{reel.number.toString().padStart(2, "0")} · {reel.label}
        </span>
        <span>{formatTcShort(citation.startMs)} — {formatTcShort(citation.endMs)}</span>
      </div>
      <div className="mt-1 font-grotesk text-[10px] uppercase tracking-wider text-ink">
        {speaker?.name ?? seg.speakerId}
      </div>
      <p className="mt-2 font-serif text-[15px] italic leading-snug">&ldquo;{seg.text}&rdquo;</p>
    </aside>
  );
}
