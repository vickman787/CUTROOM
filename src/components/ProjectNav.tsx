"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = (slug: string, reelId?: string) => [
  { href: `/projects/${slug}/screening/${reelId ?? ""}`, label: "Screening Room", match: "/screening" },
  { href: `/projects/${slug}/contact-sheet`, label: "Contact Sheet" },
  { href: `/projects/${slug}/selects`, label: "Selects Bench" },
  { href: `/projects/${slug}/paper-edit`, label: "Paper Edit" },
  { href: `/projects/${slug}/treatment`, label: "Treatment" },
  { href: `/projects/${slug}/archive`, label: "Archive Ledger" },
];

export function ProjectNav({ slug, reelId }: { slug: string; reelId?: string }) {
  const pathname = usePathname() ?? "";
  return (
    <nav className="flex items-center gap-1 overflow-x-auto border-t border-ink/30 bg-paper-warm px-6 py-1 font-grotesk text-[11px] uppercase tracking-wider">
      {SECTIONS(slug, reelId).map((s) => {
        const active = pathname.startsWith(s.match ?? s.href);
        return (
          <Link
            key={s.label}
            href={s.href}
            className={
              active
                ? "border-b-2 border-vermilion px-3 py-2 text-ink"
                : "border-b-2 border-transparent px-3 py-2 text-ink/65 hover:border-ink/30 hover:text-ink"
            }
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
