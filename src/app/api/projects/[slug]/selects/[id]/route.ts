import { NextResponse } from "next/server";
import { getAdapters } from "@/adapters";

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { persistence } = getAdapters();
  const project = await persistence.getProject(slug);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });
  await persistence.removeSelect(project.id, id);
  return NextResponse.json({ ok: true });
}
