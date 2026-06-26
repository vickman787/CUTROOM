import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { loadProjects } from "@/lib/server-projects";
import { formatDuration } from "@/lib/time";

// Opening - full-bleed projected moving image, the wordmark, and a clear path
// to the project shelf even before any project exists.

export default async function Home() {
  const projects = await loadProjects();
  const firstProject = projects[0];

  return (
    <main className="relative min-h-screen overflow-hidden text-ink">
      <ProjectedField />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1600px] flex-col px-8 py-8">
        <header className="flex items-start justify-between gap-6">
          <Wordmark size="md" />
          <div className="hidden text-right font-grotesk text-[11px] uppercase tracking-wider text-ink/70 sm:block">
            <div>Documentary pre-edit · v0.3</div>
            <div className="mt-1">Two Reels Ltd. · Lagos · {new Date().getFullYear()}</div>
          </div>
        </header>

        <section className="flex flex-1 items-end pb-12">
          <div className="max-w-[900px]">
            <p className="font-grotesk text-[11px] uppercase tracking-wider text-ink/70">
              CUTROOM · A worktable for documentary editors
            </p>
            <h1 className="mt-4 font-serif text-[clamp(48px,7vw,112px)] leading-[0.95] tracking-tight">
              Find the film inside the footage.
            </h1>
            <p className="mt-6 max-w-[720px] font-serif text-[18px] leading-[1.45] text-ink/85">
              Upload your reels. Read Claude's pass through them - speakers, scenes, themes, contradictions, the lines worth keeping. Mark selects. Move them into three acts. Print a treatment whose every claim links back to the exact moment in the footage.
            </p>

            <div className="mt-10 flex flex-col items-start gap-3">
              <Link
                href="/projects"
                className="group inline-flex items-stretch border border-ink"
              >
                <span className="bg-ink px-7 py-4 font-grotesk text-[14px] uppercase tracking-wider text-paper">
                  Project shelf
                </span>
                <span className="bg-paper px-5 py-4 font-grotesk text-[12px] uppercase tracking-wider text-ink">
                  Create or open a project
                </span>
              </Link>

              {firstProject && (
                <Link
                  href={`/projects/${firstProject.slug}/screening/${firstProject.reels[0].id}`}
                  className="font-grotesk text-[11px] uppercase tracking-wider text-ink/70 underline underline-offset-4 decoration-graphite hover:text-ink hover:decoration-vermilion"
                >
                  Enter the cut: {firstProject.title} · {firstProject.reels.length} reels · {formatDuration(firstProject.reels.reduce((a, r) => a + r.durationMs, 0))}
                </Link>
              )}
            </div>
          </div>
        </section>

        <footer className="flex items-end justify-between border-t border-ink/30 pt-4 font-grotesk text-[10px] uppercase tracking-wider text-ink/60">
          <span>Shelby · Claude · Aptos - adapter mode visible in the archive ledger.</span>
          <span>Press <kbd className="border border-ink/60 px-1">↵</kbd> on focus to enter</span>
        </footer>
      </div>
    </main>
  );
}

// CSS-painted "projection" - a wide warm cone, a faint sprocket halo, and a
// hand-painted clock-leader countdown wedge.
function ProjectedField() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-0 grain">
      <div
        className="absolute inset-0"
        style={{
          background: "var(--paper-warm)",
          backgroundImage:
            "radial-gradient(ellipse 78% 60% at 50% 56%, rgba(255, 239, 195, 0.8), rgba(239, 231, 211, 0) 70%), radial-gradient(circle at 12% 22%, rgba(0,0,0,0.06), transparent 50%), radial-gradient(circle at 88% 78%, rgba(0,0,0,0.05), transparent 55%)",
        }}
      />
      <div className="absolute inset-y-0 left-0 w-7 sprocket-strip-v opacity-80" aria-hidden />
      <div className="absolute inset-y-0 right-0 w-7 sprocket-strip-v opacity-80" aria-hidden />
      <svg
        aria-hidden
        viewBox="0 0 200 200"
        className="absolute right-[14%] top-[14%] h-[180px] w-[180px] opacity-25"
      >
        <circle cx="100" cy="100" r="95" fill="none" stroke="var(--ink)" strokeWidth="1.2" />
        <circle cx="100" cy="100" r="60" fill="none" stroke="var(--ink)" strokeWidth="1.2" />
        <line x1="100" y1="5" x2="100" y2="195" stroke="var(--ink)" strokeWidth="1" />
        <line x1="5" y1="100" x2="195" y2="100" stroke="var(--ink)" strokeWidth="1" />
        <path d="M100 100 L100 5 A95 95 0 0 1 195 100 Z" fill="var(--vermilion)" opacity="0.55" />
        <text x="100" y="118" textAnchor="middle" fontFamily="var(--font-grotesk)" fontWeight="700" fontSize="64" fill="var(--ink)">3</text>
      </svg>
    </div>
  );
}
