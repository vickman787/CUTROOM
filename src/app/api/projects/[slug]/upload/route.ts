import { NextRequest, NextResponse } from "next/server";
import { getAdapters } from "@/adapters";
import { requireUserId } from "@/lib/auth";

// Start a resumable upload through the Shelby adapter. Streaming chunked
// uploads use the /chunk endpoint. Mock-mode never lies about success — the
// resulting blob path is prefixed shelby-mock:// so the archive ledger can
// label it discreetly.

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { persistence, shelby } = getAdapters();
  const project = await persistence.getProject(slug, await requireUserId());
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const body = (await req.json()) as {
    fileName: string;
    sizeBytes: number;
    kind: "footage" | "transcript" | "treatment" | "manifest";
    label?: string;
  };

  const handle = await shelby.startUpload({
    fileName: body.fileName,
    sizeBytes: body.sizeBytes,
    kind: body.kind,
    projectId: project.id,
  });
  return NextResponse.json({ handle, mode: shelby.mode });
}
