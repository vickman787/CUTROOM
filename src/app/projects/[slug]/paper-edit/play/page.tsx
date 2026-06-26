import { notFound } from "next/navigation";
import { PaperEditPlayerClient } from "@/components/PaperEditPlayerClient";
import { loadProject } from "@/lib/server-projects";

export default async function PaperEditPlayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await loadProject(slug);
  if (!project) notFound();
  return <PaperEditPlayerClient slug={slug} fallbackProject={project} />;
}
