import { PrismaClient } from "@prisma/client";
import type {
  ArchiveEntry,
  PaperEditEntry,
  Project,
  Reel,
  ReelAnalysis,
  Select,
  Treatment,
} from "@/domain/types";
import type { PersistenceAdapter } from "./types";

const prisma = new PrismaClient();

// ── Serialization helpers ──

function serializedReelAnalysis(reel: Reel) {
  return {
    speakers: JSON.stringify(reel.analysis.speakers),
    segments: JSON.stringify(reel.analysis.segments),
    scenes: JSON.stringify(reel.analysis.scenes),
    themes: JSON.stringify(reel.analysis.themes),
    claims: JSON.stringify(reel.analysis.claims),
    contradictions: JSON.stringify(reel.analysis.contradictions),
    quotations: JSON.stringify(reel.analysis.quotations),
    suggestedSelects: JSON.stringify(reel.analysis.suggestedSelects),
    warnings: JSON.stringify(reel.analysis.contentWarnings),
  };
}

function deserializeReelAnalysis(row: {
  speakers: string;
  segments: string;
  scenes: string;
  themes: string;
  claims: string;
  contradictions: string;
  quotations: string;
  suggestedSelects: string;
  warnings: string;
}): ReelAnalysis {
  return {
    speakers: JSON.parse(row.speakers),
    segments: JSON.parse(row.segments),
    scenes: JSON.parse(row.scenes),
    themes: JSON.parse(row.themes),
    claims: JSON.parse(row.claims),
    contradictions: JSON.parse(row.contradictions),
    quotations: JSON.parse(row.quotations),
    suggestedSelects: JSON.parse(row.suggestedSelects),
    contentWarnings: JSON.parse(row.warnings),
  };
}

// ── Project read ──

async function readProject(slug: string): Promise<Project | null> {
  const row = await prisma.project.findUnique({
    where: { slug },
    include: {
      reels: { include: { selects: true } },
      selects: true,
      paperEdit: true,
      treatment: true,
      archive: true,
    },
  });
  if (!row) return null;
  return mapProject(row);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProject(row: any): Project {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    logline: row.logline,
    director: row.director,
    productionCompany: row.productionCompany,
    shotAround: row.shotAround,
    mode: row.mode,
    reels: row.reels.map(mapReel),
    selects: row.selects.map(mapSelect),
    paperEdit: row.paperEdit.map(mapPaperEditEntry),
    treatment: row.treatment ? mapTreatment(row.treatment) : emptyTreatment(row.id, row.logline),
    archive: row.archive.map(mapArchiveEntry),
  };
}

function emptyTreatment(projectId: string, logline: string): Treatment {
  return {
    projectId,
    logline,
    paragraphs: [],
    updatedAt: new Date(0).toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapReel(row: any): Reel {
  return {
    id: row.id,
    number: row.number,
    label: row.label,
    shotOn: row.shotOn,
    location: row.location,
    durationMs: row.durationMs,
    recordedAt: row.recordedAt instanceof Date ? row.recordedAt.toISOString() : String(row.recordedAt),
    posterPalette: JSON.parse(row.posterPalette),
    videoPath: row.videoPath ?? undefined,
    analysis: deserializeReelAnalysis(row),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSelect(row: any): Select {
  return {
    id: row.id,
    projectId: row.projectId,
    reelId: row.reelId,
    sourcePath: row.sourcePath ?? undefined,
    inMs: row.inMs,
    outMs: row.outMs,
    speakerId: row.speakerId,
    quote: row.quote,
    notes: row.notes,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPaperEditEntry(row: any): PaperEditEntry {
  return {
    id: row.id,
    projectId: row.projectId,
    selectId: row.selectId,
    act: row.act,
    position: row.position,
    beat: row.beat,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTreatment(row: any): Treatment {
  const body = JSON.parse(row.body);
  return {
    projectId: row.projectId,
    logline: body.logline ?? "",
    paragraphs: body.paragraphs ?? [],
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapArchiveEntry(row: any): ArchiveEntry {
  return {
    id: row.id,
    projectId: row.projectId,
    label: row.label,
    kind: row.kind,
    blobPath: row.blobPath,
    owner: row.owner,
    commitment: row.commitment,
    status: row.status,
    sizeBytes: Number(row.sizeBytes),
    expiresAt: row.expiresAt instanceof Date ? row.expiresAt.toISOString() : String(row.expiresAt),
  };
}

// ── Project write (for seeding) ──

async function writeProject(project: Project) {
  await prisma.project.create({
    data: {
      id: project.id,
      slug: project.slug,
      title: project.title,
      subtitle: project.subtitle,
      logline: project.logline,
      director: project.director,
      productionCompany: project.productionCompany,
      shotAround: project.shotAround,
      mode: project.mode,
      reels: {
        create: project.reels.map((r) => ({
          id: r.id,
          number: r.number,
          label: r.label,
          shotOn: r.shotOn,
          location: r.location,
          durationMs: r.durationMs,
          recordedAt: new Date(r.recordedAt),
          posterPalette: JSON.stringify(r.posterPalette),
          ...serializedReelAnalysis(r),
        })),
      },
      selects: {
        create: project.selects.map((s) => ({
          id: s.id,
          reelId: s.reelId,
          sourcePath: s.sourcePath,
          inMs: s.inMs,
          outMs: s.outMs,
          speakerId: s.speakerId,
          quote: s.quote,
          notes: s.notes,
          createdAt: new Date(s.createdAt),
        })),
      },
      paperEdit: {
        create: project.paperEdit.map((e) => ({
          id: e.id,
          act: e.act,
          position: e.position,
          selectId: e.selectId,
          beat: e.beat,
        })),
      },
      treatment: {
        create: {
          id: project.treatment.projectId, // treatment uses projectId as id pattern
          body: JSON.stringify({
            logline: project.treatment.logline,
            paragraphs: project.treatment.paragraphs,
          }),
        },
      },
      archive: {
        create: project.archive.map((a) => ({
          id: a.id,
          label: a.label,
          kind: a.kind,
          blobPath: a.blobPath,
          owner: a.owner,
          commitment: a.commitment,
          status: a.status,
          sizeBytes: BigInt(a.sizeBytes),
          expiresAt: new Date(a.expiresAt),
        })),
      },
    },
  });
}

// ── Adapter ──

export class PrismaPersistenceAdapter implements PersistenceAdapter {
  mode = "live" as const;

  async listProjects(): Promise<Project[]> {
    const rows = await prisma.project.findMany({
      include: {
        reels: { include: { selects: true } },
        selects: true,
        paperEdit: true,
        treatment: true,
        archive: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapProject);
  }

  async getProject(slug: string): Promise<Project | null> {
    return readProject(slug);
  }

  async createProject(project: Project): Promise<Project> {
    await writeProject(project);
    const saved = await readProject(project.slug);
    if (!saved) throw new Error(`Project was not created: ${project.slug}`);
    return saved;
  }

  async deleteProject(projectId: string): Promise<void> {
    await prisma.$transaction([
      prisma.paperEditEntry.deleteMany({ where: { projectId } }),
      prisma.select.deleteMany({ where: { projectId } }),
      prisma.treatment.deleteMany({ where: { projectId } }),
      prisma.archiveEntry.deleteMany({ where: { projectId } }),
      prisma.reel.deleteMany({ where: { projectId } }),
      prisma.project.deleteMany({ where: { id: projectId } }),
    ]);
  }

  async updateReel(projectId: string, reelId: string, data: { videoPath?: string }): Promise<Reel> {
    const updated = await prisma.reel.update({
      where: { id: reelId },
      data: {
        ...(data.videoPath !== undefined ? { videoPath: data.videoPath } : {}),
      },
    });
    return mapReel(updated);
  }

  async updateReelAnalysis(projectId: string, reelId: string, analysis: ReelAnalysis): Promise<Reel> {
    const updated = await prisma.reel.update({
      where: { id: reelId },
      data: {
        speakers: JSON.stringify(analysis.speakers),
        segments: JSON.stringify(analysis.segments),
        scenes: JSON.stringify(analysis.scenes),
        themes: JSON.stringify(analysis.themes),
        claims: JSON.stringify(analysis.claims),
        contradictions: JSON.stringify(analysis.contradictions),
        quotations: JSON.stringify(analysis.quotations),
        suggestedSelects: JSON.stringify(analysis.suggestedSelects),
        warnings: JSON.stringify(analysis.contentWarnings),
      },
    });
    return mapReel(updated);
  }

  async upsertSelect(s: Select): Promise<Select> {
    const row = await prisma.select.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        projectId: s.projectId,
        reelId: s.reelId,
        sourcePath: s.sourcePath,
        inMs: s.inMs,
        outMs: s.outMs,
        speakerId: s.speakerId,
        quote: s.quote,
        notes: s.notes,
        createdAt: new Date(s.createdAt),
      },
      update: {
        inMs: s.inMs,
        outMs: s.outMs,
        sourcePath: s.sourcePath,
        speakerId: s.speakerId,
        quote: s.quote,
        notes: s.notes,
      },
    });
    return mapSelect(row);
  }

  async removeSelect(projectId: string, selectId: string): Promise<void> {
    await prisma.paperEditEntry.deleteMany({ where: { selectId } });
    await prisma.select.delete({ where: { id: selectId } });
  }

  async replacePaperEdit(projectId: string, entries: PaperEditEntry[]): Promise<PaperEditEntry[]> {
    await prisma.paperEditEntry.deleteMany({ where: { projectId } });
    if (entries.length === 0) return [];
    await prisma.paperEditEntry.createMany({
      data: entries.map((e) => ({
        id: e.id,
        projectId,
        selectId: e.selectId,
        act: e.act,
        position: e.position,
        beat: e.beat,
      })),
    });
    const rows = await prisma.paperEditEntry.findMany({
      where: { projectId },
      orderBy: [{ act: "asc" }, { position: "asc" }],
    });
    return rows.map(mapPaperEditEntry);
  }

  async upsertTreatment(t: Treatment): Promise<Treatment> {
    const body = JSON.stringify({
      logline: t.logline,
      paragraphs: t.paragraphs,
    });
    await prisma.treatment.upsert({
      where: { projectId: t.projectId },
      create: {
        id: t.projectId,
        projectId: t.projectId,
        body,
      },
      update: { body },
    });
    return t;
  }

  async appendArchive(e: ArchiveEntry): Promise<ArchiveEntry> {
    const row = await prisma.archiveEntry.create({
      data: {
        id: e.id,
        projectId: e.projectId,
        label: e.label,
        kind: e.kind,
        blobPath: e.blobPath,
        owner: e.owner,
        commitment: e.commitment,
        status: e.status,
        sizeBytes: BigInt(e.sizeBytes),
        expiresAt: new Date(e.expiresAt),
      },
    });
    return mapArchiveEntry(row);
  }

  async removeArchive(projectId: string, entryId: string): Promise<void> {
    await prisma.archiveEntry.deleteMany({
      where: { id: entryId, projectId },
    });
  }
}
