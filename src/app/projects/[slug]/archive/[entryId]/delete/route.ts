import { NextRequest, NextResponse } from "next/server";
import { getAdapters } from "@/adapters";
import { requireUserId } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; entryId: string }> },
) {
  const { slug, entryId } = await params;
  const { persistence } = getAdapters();
  const project = await persistence.getProject(slug, await requireUserId());
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const entry = project.archive.find((item) => item.id === entryId);
  if (!entry) return NextResponse.redirect(new URL(`/projects/${slug}/archive`, req.url), 303);

  await persistence.removeArchive(project.id, entry.id);

  await Promise.all(
    project.reels
      .filter((reel) => reel.videoPath === entry.blobPath)
      .map((reel) => persistence.updateReel(project.id, reel.id, { videoPath: "" })),
  );

  return NextResponse.redirect(new URL(`/projects/${slug}/archive`, req.url), 303);
}
