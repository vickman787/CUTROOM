import { NextRequest, NextResponse } from "next/server";
import { getAdapters } from "@/adapters";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { persistence } = getAdapters();
  const project = await persistence.getProject(slug);
  if (project) {
    await persistence.deleteProject(project.id);
  }
  return NextResponse.redirect(new URL("/projects", _req.url), 303);
}
