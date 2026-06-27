// Server-side project loader. Routed through the persistence adapter so the
// same call works against the in-memory mock or a Prisma-backed store.
import { getAdapters } from "@/adapters";
import type { Project } from "@/domain/types";
import { requireUserId } from "@/lib/auth";

export async function loadProject(slug: string): Promise<Project | null> {
  const { persistence } = getAdapters();
  return persistence.getProject(slug, await requireUserId());
}

export async function loadProjects(): Promise<Project[]> {
  const { persistence } = getAdapters();
  return persistence.listProjects(await requireUserId());
}
