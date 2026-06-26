import { notFound } from "next/navigation";
import { PaperEditClient } from "@/components/PaperEditClient";
import { loadProject } from "@/lib/server-projects";

export default async function PaperEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await loadProject(slug);
  if (!project) notFound();
  return <PaperEditClient slug={slug} fallbackProject={project} />;
}
