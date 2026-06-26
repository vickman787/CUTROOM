import { NextResponse } from "next/server";
import { getAdapters } from "@/adapters";

// Resolve the playable URL for a reel. Order of precedence:
//   1. Per-reel REEL_SRC_<REELID> env var (case-insensitive id, alphanum).
//   2. PROJECT_DEFAULT_VIDEO_SRC env var — applies to every reel.
//   3. reel.videoPath — a locally uploaded file or Shelby path.
//   4. shelby.resolve(blobPath) — real Shelby path, when the live adapter works.
// If none match, returns 204 No Content and the client uses the surrogate.

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string; reelId: string }> },
) {
  const { slug, reelId } = await params;
  const { persistence, shelby } = getAdapters();
  const project = await persistence.getProject(slug);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });
  const reel = project.reels.find((r) => r.id === reelId);
  if (!reel) return NextResponse.json({ error: "reel not found" }, { status: 404 });

  const perReelKey = `REEL_SRC_${reelId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const perReel = process.env[perReelKey];
  if (perReel) {
    return NextResponse.json({ url: perReel, origin: "env-per-reel", mode: shelby.mode });
  }
  const def = process.env.PROJECT_DEFAULT_VIDEO_SRC;
  if (def) {
    return NextResponse.json({ url: def, origin: "env-default", mode: shelby.mode });
  }

  const overrideSourcePath = new URL(req.url).searchParams.get("sourcePath") ?? undefined;
  const videoPath = overrideSourcePath || reel.videoPath;

  // Check for locally uploaded file.
  if (videoPath) {
    // Local files under /uploads/ are served directly by Next.js from public/.
    if (videoPath.startsWith("/uploads/")) {
      return NextResponse.json({ url: videoPath, origin: overrideSourcePath ? "select-source" : "uploaded", mode: shelby.mode });
    }
    // Try Shelby resolve for non-local paths.
    const resolved = await shelby.resolve(videoPath);
    if (resolved) {
      return NextResponse.json({
        url: resolved.url,
        fallbackUrl: videoPath.startsWith("shelby://") && shelby.download
          ? `/api/projects/${slug}/reels/${reelId}/media?sourcePath=${encodeURIComponent(videoPath)}`
          : undefined,
        origin: overrideSourcePath ? "select-source" : "shelby",
        mode: shelby.mode,
      });
    }
  }

  // Legacy fallback: search archive entries by reel number.
  const blobPath = project.archive.find(
    (a) => a.kind === "footage" && a.label.toLowerCase().includes(`reel ${reel.number.toString().padStart(2, "0")}`),
  )?.blobPath;
  if (blobPath) {
    const resolved = await shelby.resolve(blobPath);
    if (resolved) {
      return NextResponse.json({ url: resolved.url, origin: "shelby", mode: shelby.mode });
    }
  }

  return new NextResponse(null, { status: 204 });
}
