"use client";

import { useEffect } from "react";
import { hydrateProject } from "@/lib/project-store";
import type { Project } from "@/domain/types";

export function ProjectHydrator({ project }: { project: Project }) {
  useEffect(() => {
    hydrateProject(project);
  }, [project]);
  return null;
}
