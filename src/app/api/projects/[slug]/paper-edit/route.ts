import { NextRequest, NextResponse } from "next/server";
import { getAdapters } from "@/adapters";
import type { PaperEditEntry } from "@/domain/types";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { persistence } = getAdapters();
  const project = await persistence.getProject(slug);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });
  const body = (await req.json()) as PaperEditEntry[];
  const result = await persistence.replacePaperEdit(
    project.id,
    body.map((e) => ({ ...e, projectId: project.id })),
  );
  return NextResponse.json(result);
}
