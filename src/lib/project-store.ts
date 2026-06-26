"use client";

import { useSyncExternalStore } from "react";
import type { PaperEditEntry, Project, ReelAnalysis, Select, TranscriptSegment } from "@/domain/types";

type Listener = () => void;

const projects = new Map<string, Project>();
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

export function hydrateProject(p: Project) {
  projects.set(p.slug, p);
  emit();
}

export function getCachedProject(slug: string): Project | undefined {
  return projects.get(slug);
}

function update(slug: string, mutate: (p: Project) => Project) {
  const cur = projects.get(slug);
  if (!cur) return;
  projects.set(slug, mutate(cur));
  emit();
}

export function useProject(slug: string): Project | undefined {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => projects.get(slug),
    () => projects.get(slug)
  );
}

export async function saveSelect(slug: string, s: Select) {
  update(slug, (p) => {
    const idx = p.selects.findIndex((x) => x.id === s.id);
    const next = idx >= 0 ? p.selects.map((x) => (x.id === s.id ? s : x)) : [...p.selects, s];
    return { ...p, selects: next };
  });
  const res = await fetch(`/api/projects/${slug}/selects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(s),
  });
  if (!res.ok) {
    console.error("saveSelect failed:", await res.text());
  }
}

export async function removeSelect(slug: string, selectId: string) {
  update(slug, (p) => ({
    ...p,
    selects: p.selects.filter((s) => s.id !== selectId),
    paperEdit: p.paperEdit.filter((e) => e.selectId !== selectId),
  }));
  await fetch(`/api/projects/${slug}/selects/${selectId}`, { method: "DELETE" });
}

export function replaceReelVideo(slug: string, reelId: string, videoPath: string) {
  update(slug, (p) => ({
    ...p,
    reels: p.reels.map((r) =>
      r.id === reelId ? { ...r, videoPath, analysis: emptyAnalysis() } : r,
    ),
    selects: p.selects.filter((s) => s.reelId !== reelId),
    paperEdit: p.paperEdit.filter((e) => p.selects.some((s) => s.id === e.selectId && s.reelId !== reelId)),
  }));
}

export function replaceReelTranscript(slug: string, reelId: string, segments: TranscriptSegment[]) {
  update(slug, (p) => ({
    ...p,
    reels: p.reels.map((r) =>
      r.id === reelId
        ? {
            ...r,
            analysis: {
              ...r.analysis,
              speakers: dedupeSpeakers(segments, r.analysis.speakers),
              segments,
            },
          }
        : r,
    ),
  }));
}

export async function replacePaperEdit(slug: string, entries: PaperEditEntry[]) {
  const normalized = entries.map((e, i) => ({ ...e, position: i }));
  update(slug, (p) => ({ ...p, paperEdit: normalized }));
  await fetch(`/api/projects/${slug}/paper-edit`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(normalized),
  });
}

function emptyAnalysis(): ReelAnalysis {
  return {
    speakers: [],
    segments: [],
    scenes: [],
    themes: [],
    claims: [],
    contradictions: [],
    quotations: [],
    contentWarnings: [],
    suggestedSelects: [],
  };
}

function dedupeSpeakers(
  segments: TranscriptSegment[],
  existing: ReelAnalysis["speakers"],
): ReelAnalysis["speakers"] {
  const seen = new Set(existing.map((s) => s.id));
  const next = [...existing];
  for (const segment of segments) {
    if (!seen.has(segment.speakerId)) {
      seen.add(segment.speakerId);
      next.push({ id: segment.speakerId, name: `Speaker ${segment.speakerId}`, role: "unknown" });
    }
  }
  return next;
}
