import { NextResponse } from "next/server";
import { getAdapters } from "@/adapters";
import { requireUserId } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; entryId: string }> },
) {
  const { slug, entryId } = await params;
  const { persistence, shelby } = getAdapters();
  const project = await persistence.getProject(slug, await requireUserId());
  if (!project) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  const entry = project.archive.find((item) => item.id === entryId);
  if (!entry || entry.kind !== "footage") {
    return NextResponse.json({ error: "footage not found" }, { status: 404 });
  }
  if (!entry.blobPath.startsWith("shelby://")) {
    return NextResponse.json(
      { error: "this entry is not stored on the live Shelby network" },
      { status: 409 },
    );
  }

  try {
    const resolved = await shelby.resolve(entry.blobPath);
    if (!resolved) {
      return NextResponse.json({ error: "unable to resolve Shelby footage" }, { status: 502 });
    }
    return NextResponse.redirect(resolved.url, 307);
  } catch (error) {
    console.error("[CUTROOM download] Shelby URL resolution failed", {
      projectId: project.id,
      entryId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "unable to prepare download" }, { status: 502 });
  }
}
