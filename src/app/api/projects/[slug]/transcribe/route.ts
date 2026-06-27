import { NextRequest, NextResponse } from "next/server";
import { getAdapters } from "@/adapters";
import { randomUUID } from "node:crypto";
import { setJobState } from "@/lib/redis-jobs";
import { requireUserId } from "@/lib/auth";

// Submit a reel's uploaded video for transcription. Accepts { reelId, videoPath? }
// where videoPath is the local file path (e.g. "/uploads/cutroom-upload-xxx.mp4").
// Falls back to the reel's stored videoPath if not provided in the body.
// Persists transcript segments to the database on success.

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const jobId = `transcribe_${randomUUID()}`;
  const { persistence, shelby, transcription } = getAdapters();
  const project = await persistence.getProject(slug, await requireUserId());
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const body = (await req.json()) as { audioUrl?: string; videoPath?: string; reelId: string };
  const reel = project.reels.find((r) => r.id === body.reelId);
  if (!reel) return NextResponse.json({ error: "reel not found" }, { status: 404 });

  const preferredSource = body.audioUrl ?? body.videoPath;
  const rawAudioUrl = preferredSource?.startsWith("blob:") ? reel.videoPath : preferredSource ?? reel.videoPath;
  const audioUrl = await resolveAudioUrl(rawAudioUrl, req.nextUrl.origin, shelby);
  if (!audioUrl) {
    return NextResponse.json(
      { error: "no audio source — upload a video first or provide audioUrl/videoPath" },
      { status: 400 },
    );
  }

  try {
    await setJobState({
      id: jobId,
      kind: "transcribe",
      status: "running",
      projectId: project.id,
      reelId: body.reelId,
      message: `Transcribing with ${transcription.provider}.`,
    });

    const result = await transcription.transcribe({
      audioUrl,
      reelId: body.reelId,
    });

    // Persist the transcript segments and speakers to the database.
    // Preserve the rest of the existing analysis data.
    const updatedAnalysis = {
      ...reel.analysis,
      speakers: result.segments.length > 0
        ? dedupeSpeakers(result.segments, reel.analysis.speakers)
        : reel.analysis.speakers,
      segments: result.segments,
    };
    await persistence.updateReelAnalysis(project.id, body.reelId, updatedAnalysis);

    await setJobState({
      id: jobId,
      kind: "transcribe",
      status: "done",
      projectId: project.id,
      reelId: body.reelId,
      message: "Transcript persisted.",
      result: { segments: result.segments.length, language: result.language, durationMs: result.durationMs },
    });

    return NextResponse.json({
      jobId,
      mode: transcription.mode,
      provider: transcription.provider,
      persisted: true,
      ...result,
    });
  } catch (e: unknown) {
    await setJobState({
      id: jobId,
      kind: "transcribe",
      status: "failed",
      projectId: project.id,
      reelId: body.reelId,
      error: (e as Error).message,
    });
    return NextResponse.json(
      { error: (e as Error).message, mode: transcription.mode, provider: transcription.provider },
      { status: 502 },
    );
  }
}

async function resolveAudioUrl(
  source: string | undefined,
  origin: string,
  shelby: ReturnType<typeof getAdapters>["shelby"],
): Promise<string | undefined> {
  if (!source) return undefined;
  if (source.startsWith("/")) return new URL(source, origin).toString();
  if (source.startsWith("http://") || source.startsWith("https://")) return source;
  const resolved = await shelby.resolve(source);
  return resolved?.url;
}

function dedupeSpeakers(
  segments: { speakerId: string }[],
  existing: { id: string; name: string; role: string }[],
) {
  const seen = new Set(existing.map((s) => s.id));
  const added: { id: string; name: string; role: string }[] = [];
  for (const seg of segments) {
    if (!seen.has(seg.speakerId)) {
      seen.add(seg.speakerId);
      added.push({ id: seg.speakerId, name: `Speaker ${seg.speakerId}`, role: "unknown" });
    }
  }
  return [...existing, ...added];
}
