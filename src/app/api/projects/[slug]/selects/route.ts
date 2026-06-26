import { NextRequest, NextResponse } from "next/server";
import { getAdapters } from "@/adapters";
import type { Select } from "@/domain/types";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { persistence } = getAdapters();
  const project = await persistence.getProject(slug);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });
  const body = (await req.json()) as Select;
  const saved = await persistence.upsertSelect({ ...body, projectId: project.id });
  return NextResponse.json(saved);
}
