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

// A process-wide in-memory store. Node module caching gives this single-process
// stability without us having to invent global keys. In a multi-instance
// deployment, swap this for the Prisma-backed adapter described in
// prisma/schema.prisma.

const store = {
  projects: new Map<string, Project>(),
  owners: new Map<string, string>(),
};

export class MemoryPersistenceAdapter implements PersistenceAdapter {
  mode = "local-mock" as const;

  async listProjects(ownerId: string): Promise<Project[]> {
    return Array.from(store.projects.values()).filter(
      (project) => store.owners.get(project.id) === ownerId,
    );
  }

  async getProject(slug: string, ownerId: string): Promise<Project | null> {
    const project = store.projects.get(slug);
    return project && store.owners.get(project.id) === ownerId ? project : null;
  }

  async createProject(project: Project, ownerId: string): Promise<Project> {
    store.projects.set(project.slug, project);
    store.owners.set(project.id, ownerId);
    return project;
  }

  async deleteProject(projectId: string): Promise<void> {
    for (const [slug, project] of store.projects.entries()) {
      if (project.id === projectId) {
        store.projects.delete(slug);
        store.owners.delete(projectId);
        return;
      }
    }
  }

  async upsertSelect(s: Select): Promise<Select> {
    const proj = findProjectById(s.projectId);
    const idx = proj.selects.findIndex((x) => x.id === s.id);
    if (idx >= 0) proj.selects[idx] = s;
    else proj.selects.push(s);
    return s;
  }

  async updateReel(projectId: string, reelId: string, data: { videoPath?: string }): Promise<Reel> {
    const proj = findProjectById(projectId);
    const reel = proj.reels.find((r) => r.id === reelId);
    if (!reel) throw new Error(`Reel not found: ${reelId}`);
    if (data.videoPath !== undefined) reel.videoPath = data.videoPath;
    return reel;
  }

  async updateReelAnalysis(projectId: string, reelId: string, analysis: ReelAnalysis): Promise<Reel> {
    const proj = findProjectById(projectId);
    const reel = proj.reels.find((r) => r.id === reelId);
    if (!reel) throw new Error(`Reel not found: ${reelId}`);
    reel.analysis = analysis;
    return reel;
  }

  async removeSelect(projectId: string, selectId: string): Promise<void> {
    const proj = findProjectById(projectId);
    proj.selects = proj.selects.filter((s) => s.id !== selectId);
    proj.paperEdit = proj.paperEdit.filter((e) => e.selectId !== selectId);
  }

  async replacePaperEdit(projectId: string, entries: PaperEditEntry[]): Promise<PaperEditEntry[]> {
    const proj = findProjectById(projectId);
    proj.paperEdit = entries.map((e, i) => ({ ...e, position: i }));
    return proj.paperEdit;
  }

  async upsertTreatment(t: Treatment): Promise<Treatment> {
    const proj = findProjectById(t.projectId);
    proj.treatment = t;
    return t;
  }

  async appendArchive(e: ArchiveEntry): Promise<ArchiveEntry> {
    const proj = findProjectById(e.projectId);
    proj.archive.push(e);
    return e;
  }

  async removeArchive(projectId: string, entryId: string): Promise<void> {
    const proj = findProjectById(projectId);
    proj.archive = proj.archive.filter((entry) => entry.id !== entryId);
  }
}

function findProjectById(projectId: string): Project {
  for (const proj of store.projects.values()) {
    if (proj.id === projectId) return proj;
  }
  throw new Error(`Project not found: ${projectId}`);
}
