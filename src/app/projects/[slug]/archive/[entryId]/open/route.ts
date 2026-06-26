import { NextRequest, NextResponse } from "next/server";
import { getAdapters } from "@/adapters";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; entryId: string }> },
) {
  const { slug, entryId } = await params;
  const { persistence } = getAdapters();
  const project = await persistence.getProject(slug);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const entry = project.archive.find((item) => item.id === entryId);
  if (!entry) return NextResponse.json({ error: "archive entry not found" }, { status: 404 });
  if (entry.kind !== "footage") return NextResponse.json({ error: "archive entry is not footage" }, { status: 400 });

  const form = await req.formData();
  const requestedReelId = form.get("reelId")?.toString();
  const reel = project.reels.find((r) => r.id === requestedReelId) ?? project.reels[0];
  if (!reel) return NextResponse.json({ error: "project has no reel" }, { status: 400 });

  await persistence.updateReel(project.id, reel.id, { videoPath: entry.blobPath });

  return NextResponse.redirect(new URL(`/projects/${slug}/screening/${reel.id}`, req.url), 303);
}
