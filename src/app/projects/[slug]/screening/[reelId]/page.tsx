import { notFound } from "next/navigation";
import { ScreeningRoom } from "@/components/ScreeningRoom";
import { loadProject } from "@/lib/server-projects";

export default async function ScreeningRoomPage({
  params,
}: {
  params: Promise<{ slug: string; reelId: string }>;
}) {
  const { slug, reelId } = await params;
  const project = await loadProject(slug);
  if (!project) notFound();
  const reel = project.reels.find((r) => r.id === reelId);
  if (!reel) notFound();
  return <ScreeningRoom slug={slug} reelId={reelId} fallbackProject={project} />;
}
