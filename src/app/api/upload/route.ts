import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import { getAdapters } from "@/adapters";
import { requireUserId } from "@/lib/auth";
import { setJobState } from "@/lib/redis-jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

// Accepts a single video file via multipart form.
// In live Shelby mode, the file is uploaded to Shelby and the reel stores the
// sealed Shelby blob path. Without live Shelby, development falls back to
// public/uploads for local playback.
// Returns { url, path, name, size } so the client can feed the video player
// and also link the file to a reel for persistence.
//
// Optional fields in the form:
//   reelId — if provided, the uploaded file path is written back to that reel.

export async function POST(req: NextRequest) {
  const jobId = `upload_${randomUUID()}`;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "expected a file in multipart field 'file'" }, { status: 400 });
    }

    const reelId = form.get("reelId")?.toString();
    const { persistence, shelby } = getAdapters();
    const projects = await persistence.listProjects(await requireUserId());
    const project = reelId
      ? projects.find((p) => p.reels.some((r) => r.id === reelId))
      : undefined;
    console.info("[CUTROOM upload] received", {
      jobId,
      fileName: file.name,
      sizeBytes: file.size,
      reelId,
      storageMode: shelby.mode,
      projectId: project?.id,
    });

    await setJobState({
      id: jobId,
      kind: "upload",
      status: "running",
      projectId: project?.id,
      reelId,
      message: shelby.mode === "live" ? "Uploading footage to Shelby." : "Saving footage to local development storage.",
    });

    const bytes = new Uint8Array(await file.arrayBuffer());

    if (shelby.mode === "live") {
      if (!project || !reelId) {
        console.error("[CUTROOM upload] Shelby upload missing reel/project", {
          jobId,
          reelId,
          hasProject: !!project,
        });
        return NextResponse.json({ error: "reelId is required for Shelby uploads" }, { status: 400 });
      }

      const started = await shelby.startUpload({
        fileName: file.name,
        sizeBytes: file.size,
        kind: "footage",
        projectId: project.id,
      });
      const progress = await shelby.appendChunk(started.uploadId, bytes, 0);
      if (progress.status === "failed") {
        console.error("[CUTROOM upload] Shelby chunk upload failed", {
          jobId,
          uploadId: started.uploadId,
          error: progress.error,
        });
        throw new Error(progress.error ?? "Shelby chunk upload failed");
      }
      const sealed = await shelby.seal(started.uploadId);
      await persistence.updateReel(project.id, reelId, { videoPath: sealed.blobPath });
      await persistence.appendArchive({
        id: `arc_${randomUUID()}`,
        projectId: project.id,
        kind: "footage",
        label: file.name,
        blobPath: sealed.blobPath,
        owner: "shelby",
        commitment: sealed.commitment,
        status: "sealed",
        sizeBytes: sealed.sizeBytes,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 5).toISOString(),
      });

      const resolved = await shelby.resolve(sealed.blobPath);
      await setJobState({
        id: jobId,
        kind: "upload",
        status: "done",
        projectId: project.id,
        reelId,
        message: "Footage sealed in Shelby.",
        result: { blobPath: sealed.blobPath, commitment: sealed.commitment },
      });

      return NextResponse.json({
        jobId,
        url: resolved?.url,
        path: sealed.blobPath,
        blobPath: sealed.blobPath,
        name: file.name,
        size: file.size,
        storage: "shelby",
        commitment: sealed.commitment,
      });
    }

    const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() ?? "mp4" : "mp4";
    const safeExt = /^[a-z0-9]{1,6}$/.test(ext) ? ext : "mp4";
    const id = randomBytes(8).toString("hex");
    const dest = `cutroom-upload-${id}.${safeExt}`;

    const uploadsDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });
    await writeFile(join(uploadsDir, dest), bytes);

    const videoPath = `/uploads/${dest}`;

    // If a reelId was provided, link the uploaded video to that reel.
    if (project && reelId) {
      await persistence.updateReel(project.id, reelId, { videoPath });
    }

    await setJobState({
      id: jobId,
      kind: "upload",
      status: "done",
      projectId: project?.id,
      reelId,
      message: "Footage saved to local development storage.",
      result: { path: videoPath },
    });

    return NextResponse.json({ jobId, url: videoPath, path: videoPath, name: file.name, size: file.size, storage: "local" });
  } catch (e: unknown) {
    const error = toErrorLog(e);
    console.error("[CUTROOM upload] failed", {
      jobId,
      ...error,
    });
    await setJobState({
      id: jobId,
      kind: "upload",
      status: "failed",
      error: (e as Error).message,
    });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

function toErrorLog(e: unknown) {
  if (!(e instanceof Error)) return { error: String(e) };
  const cause = e.cause;
  return {
    error: e.message,
    name: e.name,
    stack: e.stack,
    cause: cause instanceof Error
      ? {
          name: cause.name,
          message: cause.message,
          stack: cause.stack,
          code: (cause as NodeJS.ErrnoException).code,
          errno: (cause as NodeJS.ErrnoException).errno,
          syscall: (cause as NodeJS.ErrnoException).syscall,
          hostname: (cause as NodeJS.ErrnoException & { hostname?: string }).hostname,
        }
      : cause,
  };
}
