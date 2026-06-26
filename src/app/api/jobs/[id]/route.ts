import { NextResponse } from "next/server";
import { getJobState, redisConfigured } from "@/lib/redis-jobs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!redisConfigured()) {
    return NextResponse.json({ error: "Redis is not configured" }, { status: 503 });
  }
  const job = await getJobState(id);
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });
  return NextResponse.json(job);
}
