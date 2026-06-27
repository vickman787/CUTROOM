import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Wordmark } from "./Wordmark";

export function ReelHeader({
  projectSlug,
  reelLabel,
  trail,
}: {
  projectSlug?: string;
  reelLabel?: string;
  trail: { href: string; label: string; current?: boolean }[];
}) {
  return (
    <header className="border-b border-ink/80 bg-paper">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-6 px-6 py-3">
        <Link href="/" className="flex items-center gap-3" aria-label="CUTROOM home">
          <Wordmark size="sm" />
        </Link>
        <nav className="hidden flex-1 items-center justify-center gap-4 font-grotesk text-[11px] uppercase tracking-wider text-ink/80 md:flex">
          {trail.map((t, i) => (
            <span key={t.href} className="inline-flex items-center gap-3">
              <Link
                href={t.href}
                className={t.current ? "text-ink underline underline-offset-4 decoration-vermilion decoration-2" : "hover:text-ink"}
              >
                {t.label}
              </Link>
              {i < trail.length - 1 && <span aria-hidden className="text-graphite-light">/</span>}
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-3 font-grotesk text-[11px] uppercase tracking-wider text-ink/80">
          {projectSlug && (
            <span className="hidden sm:inline">Project · {projectSlug}</span>
          )}
          {reelLabel && (
            <span className="edit-mark" title="Current reel">
              {reelLabel}
            </span>
          )}
          <UserButton />
        </div>
      </div>
    </header>
  );
}
