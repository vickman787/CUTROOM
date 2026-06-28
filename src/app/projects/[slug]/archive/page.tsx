import { notFound } from "next/navigation";
import { getAdapters } from "@/adapters";
import { loadProject } from "@/lib/server-projects";
import { formatBytes } from "@/lib/time";
import type { ArchiveEntry } from "@/domain/types";

// Archive Ledger — production-provenance table. Shows Shelby blob path,
// owner, commitment, status, size, expiration. Discreetly labels mock-mode
// entries so the operator can tell which records are real.

export default async function ArchivePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await loadProject(slug);
  if (!project) notFound();
  const { report } = getAdapters();

  const grouped: Record<ArchiveEntry["kind"], ArchiveEntry[]> = {
    footage: [],
    transcript: [],
    treatment: [],
    manifest: [],
  };
  for (const e of project.archive) grouped[e.kind].push(e);

  return (
    <main className="mx-auto max-w-[1600px] px-8 py-8">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <p className="font-grotesk text-[11px] uppercase tracking-wider text-ink/65">PROVENANCE</p>
          <h1 className="mt-1 font-serif text-[36px] leading-none tracking-tight">Archive Ledger</h1>
          <p className="mt-2 max-w-[640px] font-serif text-[14px] leading-snug text-ink/80">
            Every reel, transcript, manifest, and treatment that this project commits to long-term storage is recorded here with its owner, commitment, and expiration.
          </p>
        </div>
        <ModeBadge mode={report.mode} note={report.note} />
      </header>

      {(["footage", "transcript", "manifest", "treatment"] as const).map((kind) => (
        <section key={kind} className="mt-8">
          <h2 className="mb-2 border-b border-ink/40 pb-1 font-grotesk text-[12px] uppercase tracking-wider text-ink/70">
            {kindLabel(kind)} · {grouped[kind].length}
          </h2>
          <ul className="grid grid-cols-1 gap-3">
            {grouped[kind].map((e) => (
              <LedgerRow key={e.id} entry={e} slug={slug} reels={project.reels} />
            ))}
          </ul>
        </section>
      ))}

      <footer className="mt-12 border-t border-ink/40 pt-3 font-grotesk text-[10px] uppercase tracking-wider text-ink/65">
        Adapters · Shelby: {report.shelby} · Claude: {report.claude} · Aptos: {report.aptos} · Persistence: {report.persistence} · Transcription: {report.transcription} ({report.transcriptionProvider})
      </footer>
    </main>
  );
}

function ModeBadge({ mode, note }: { mode: "local-mock" | "live"; note: string }) {
  const live = mode === "live";
  return (
    <div className="max-w-[300px] border border-ink bg-paper-warm p-3">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={live ? "h-2 w-2 bg-vermilion" : "h-2 w-2 border border-ink"}
        />
        <span className="font-grotesk text-[10px] uppercase tracking-wider text-ink">
          Mode · {live ? "Live (mixed)" : "Local-mock"}
        </span>
      </div>
      <p className="mt-1 font-serif text-[12px] leading-snug text-ink/80">{note}</p>
    </div>
  );
}

function LedgerRow({ entry, slug, reels }: { entry: ArchiveEntry; slug: string; reels: { id: string; number: number; label: string }[] }) {
  const sim = entry.blobPath.startsWith("shelby-mock://");
  return (
    <li className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 border border-ink/40 bg-paper-warm p-3">
      <div>
        <div className="font-grotesk text-[10px] uppercase tracking-wider text-ink/65">{entry.kind}</div>
        <div className="mt-0.5 font-serif text-[15px]">{entry.label}</div>
      </div>
      <div>
        <div className="font-grotesk text-[10px] uppercase tracking-wider text-ink/65">Blob path</div>
        <div className="mt-0.5 font-mono text-[11px] text-ink/90 break-all">
          {entry.blobPath}
          {sim && (
            <span className="ml-2 inline-block border border-ink/40 px-1.5 py-0 font-grotesk text-[9px] uppercase tracking-wider text-ink/70">
              simulated
            </span>
          )}
        </div>
      </div>
      <div>
        <div className="font-grotesk text-[10px] uppercase tracking-wider text-ink/65">Owner</div>
        <div className="mt-0.5 font-mono text-[11px]">{entry.owner}</div>
      </div>
      <div>
        <div className="font-grotesk text-[10px] uppercase tracking-wider text-ink/65">Commitment</div>
        <div className="mt-0.5 font-mono text-[11px]">{entry.commitment}</div>
      </div>
      <div>
        <div className="font-grotesk text-[10px] uppercase tracking-wider text-ink/65">Status / Size</div>
        <div className="mt-0.5 font-grotesk text-[11px] uppercase tracking-wider">
          <span className={statusClass(entry.status)}>{entry.status}</span>
          <span className="mx-2 text-ink/40">·</span>
          <span>{formatBytes(entry.sizeBytes)}</span>
        </div>
      </div>
      <div>
        <div className="font-grotesk text-[10px] uppercase tracking-wider text-ink/65">Expires</div>
        <div className="mt-0.5 font-mono text-[11px]">
          {new Date(entry.expiresAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}
        </div>
        {entry.kind === "footage" && (
          <div className="mt-2 space-y-2">
            <form action={`/projects/${slug}/archive/${entry.id}/open`} method="post">
              {reels.length > 1 && (
                <select
                  name="reelId"
                  defaultValue={reels[0]?.id}
                  className="mb-2 w-full border border-ink/50 bg-paper px-1 py-0.5 font-grotesk text-[10px] uppercase tracking-wider"
                >
                  {reels.map((reel) => (
                    <option key={reel.id} value={reel.id}>
                      R{reel.number.toString().padStart(2, "0")} · {reel.label}
                    </option>
                  ))}
                </select>
              )}
              {reels.length <= 1 && reels[0] && <input type="hidden" name="reelId" value={reels[0].id} />}
              <button
                type="submit"
                className="border border-ink bg-paper px-2 py-1 font-grotesk text-[10px] uppercase tracking-wider hover:bg-ink hover:text-paper"
              >
                Open in screening room
              </button>
            </form>
            {!sim && entry.status === "sealed" && (
              <a
                href={`/projects/${slug}/archive/${entry.id}/download`}
                className="inline-block border border-ink bg-ink px-2 py-1 font-grotesk text-[10px] uppercase tracking-wider text-paper hover:border-vermilion hover:bg-vermilion"
              >
                Download video
              </a>
            )}
            <form action={`/projects/${slug}/archive/${entry.id}/delete`} method="post">
              <button
                type="submit"
                className="border border-vermilion/70 bg-paper px-2 py-1 font-grotesk text-[10px] uppercase tracking-wider text-vermilion hover:bg-vermilion hover:text-paper"
              >
                Delete ledger entry
              </button>
            </form>
          </div>
        )}
      </div>
    </li>
  );
}

function statusClass(s: ArchiveEntry["status"]): string {
  switch (s) {
    case "sealed":
      return "text-ink";
    case "warming":
      return "text-graphite";
    case "draft":
      return "text-ink/80";
    case "expiring":
      return "text-vermilion";
  }
}

function kindLabel(k: ArchiveEntry["kind"]): string {
  if (k === "footage") return "Sealed footage";
  if (k === "transcript") return "Transcripts";
  if (k === "treatment") return "Treatments";
  return "Manifests";
}
