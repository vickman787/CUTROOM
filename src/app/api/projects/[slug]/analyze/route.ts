import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAdapters } from "@/adapters";
import { ReelAnalysisSchema } from "@/domain/schemas";
import { setJobState } from "@/lib/redis-jobs";
import { requireUserId } from "@/lib/auth";

// Submit a reel's transcript to Anthropic for analysis and persist the result.
// Requires transcript segments produced by the transcribe step.

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const jobId = `analyze_${randomUUID()}`;
  const { persistence, claude } = getAdapters();
  const project = await persistence.getProject(slug, await requireUserId());
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const body = (await req.json()) as { reelId: string };
  const reel = project.reels.find((r) => r.id === body.reelId);
  if (!reel) return NextResponse.json({ error: "reel not found" }, { status: 404 });

  if (!reel.analysis.segments || reel.analysis.segments.length === 0) {
    return NextResponse.json(
      { error: "no transcript segments found - transcribe the reel first" },
      { status: 400 },
    );
  }

  const rawTranscript = reel.analysis.segments
    .map((s) => {
      const spk = reel.analysis.speakers.find((sp) => sp.id === s.speakerId);
      return `${spk?.name ?? s.speakerId}: ${s.text}`;
    })
    .join("\n\n");

  let analysis;
  const mode = claude.mode;

  try {
    await setJobState({
      id: jobId,
      kind: "analyze",
      status: "running",
      projectId: project.id,
      reelId: body.reelId,
      message: "Analyzing transcript with Anthropic.",
    });

    analysis = await claude.analyzeReel({
      reelId: reel.id,
      label: reel.label,
      speakers: reel.analysis.speakers,
      rawTranscript,
      runtimeMs: reel.durationMs,
    });
  } catch (e: unknown) {
    const err = e as Error;
    console.error("[analyze] Anthropic analysis failed", {
      projectSlug: slug,
      projectId: project.id,
      reelId: reel.id,
      claudeMode: claude.mode,
      message: err.message,
    });
    await setJobState({
      id: jobId,
      kind: "analyze",
      status: "failed",
      projectId: project.id,
      reelId: body.reelId,
      error: err.message,
    });
    return NextResponse.json({ error: err.message }, { status: 502 });
  }

  const parsed = ReelAnalysisSchema.safeParse(analysis);
  if (!parsed.success) {
    console.error("[analyze] analysis failed schema validation", {
      reelId: reel.id,
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
    await setJobState({
      id: jobId,
      kind: "analyze",
      status: "failed",
      projectId: project.id,
      reelId: body.reelId,
      error: "analysis failed schema validation",
    });
    return NextResponse.json(
      { error: "analysis failed schema validation", detail: parsed.error.flatten() },
      { status: 502 },
    );
  }

  await persistence.updateReelAnalysis(project.id, body.reelId, parsed.data);

  await setJobState({
    id: jobId,
    kind: "analyze",
    status: "done",
    projectId: project.id,
    reelId: body.reelId,
    message: "Analysis persisted.",
    result: {
      themes: parsed.data.themes.length,
      quotations: parsed.data.quotations.length,
      suggestedSelects: parsed.data.suggestedSelects.length,
    },
  });

  return NextResponse.json({
    jobId,
    mode,
    analysis: parsed.data,
    persisted: true,
    usedFallback: false,
  });
}
