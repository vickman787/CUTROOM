import { randomUUID } from "node:crypto";
import { getAdapters } from "@/adapters";
import type { Project, ReelAnalysis } from "@/domain/types";

const DEFAULT_PALETTE: [string, string, string] = ["#1d1c1a", "#4b5b5f", "#d7c68c"];

export interface CreateProjectInput {
  title: string;
  logline?: string;
  director?: string;
  productionCompany?: string;
  shotAround?: string;
}

export async function createProject(input: CreateProjectInput, ownerId: string): Promise<Project> {
  const { persistence } = getAdapters();
  const title = clean(input.title) || "Untitled Project";
  const baseSlug = slugify(title) || "untitled-project";
  const slug = await uniqueSlug(baseSlug, ownerId);
  const projectId = `proj_${randomUUID()}`;
  const reelId = `reel_${randomUUID()}`;
  const now = new Date().toISOString();
  const logline = clean(input.logline);

  const project: Project = {
    id: projectId,
    slug,
    title,
    subtitle: logline || "Untitled documentary",
    logline,
    director: clean(input.director),
    productionCompany: clean(input.productionCompany),
    shotAround: clean(input.shotAround),
    reels: [
      {
        id: reelId,
        number: 1,
        label: "Reel 01",
        shotOn: "",
        location: "",
        durationMs: 60_000,
        recordedAt: now,
        posterPalette: DEFAULT_PALETTE,
        analysis: emptyAnalysis(),
      },
    ],
    selects: [],
    paperEdit: [],
    treatment: {
      projectId,
      logline,
      paragraphs: [],
      updatedAt: now,
    },
    archive: [],
    mode: persistence.mode,
  };

  return persistence.createProject(project, ownerId);
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

async function uniqueSlug(baseSlug: string, ownerId: string): Promise<string> {
  const { persistence } = getAdapters();
  let slug = baseSlug;
  let suffix = 2;
  while (await persistence.getProject(slug, ownerId)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

function clean(value: FormDataEntryValue | string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
