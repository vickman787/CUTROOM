import { NextRequest, NextResponse } from "next/server";
import { getAdapters } from "@/adapters";
import { requireUserId } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; reelId: string }> },
) {
  const { slug, reelId } = await params;
  const { persistence, shelby } = getAdapters();
  const project = await persistence.getProject(slug, await requireUserId());
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const reel = project.reels.find((r) => r.id === reelId);
  if (!reel) return NextResponse.json({ error: "reel not found" }, { status: 404 });
  const sourcePath = req.nextUrl.searchParams.get("sourcePath") ?? reel.videoPath;
  if (!sourcePath) return NextResponse.json({ error: "no video uploaded" }, { status: 404 });
  if (!shelby.download) return NextResponse.json({ error: "Shelby media download is not available" }, { status: 502 });

  const archiveEntry = project.archive.find((entry) => entry.blobPath === sourcePath);
  const totalSize = archiveEntry?.sizeBytes;
  const range = parseRange(req.headers.get("range"));
  try {
    const media = await shelby.download(sourcePath, range);
    if (!media) return NextResponse.json({ error: "unable to resolve Shelby media" }, { status: 404 });

    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Content-Type": media.contentType ?? "application/octet-stream",
      "Cache-Control": "private, max-age=60",
    });

    if (range) {
      const end = range.start + media.contentLength - 1;
      headers.set("Content-Range", `bytes ${range.start}-${end}/${totalSize ?? "*"}`);
      headers.set("Content-Length", String(media.contentLength));
      return new NextResponse(media.readable, { status: 206, headers });
    }

    headers.set("Content-Length", String(totalSize ?? media.contentLength));
    return new NextResponse(media.readable, { headers });
  } catch (e) {
    console.error("[CUTROOM media] Shelby playback failed", {
      projectId: project.id,
      reelId,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return NextResponse.json({ error: "Shelby media playback failed" }, { status: 502 });
  }
}

function parseRange(header: string | null) {
  if (!header) return undefined;
  const match = /^bytes=(\d+)-(\d*)$/.exec(header);
  if (!match) return undefined;
  return {
    start: Number(match[1]),
    end: match[2] ? Number(match[2]) : undefined,
  };
}
