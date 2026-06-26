import { notFound } from "next/navigation";
import { SelectsBenchClient } from "@/components/SelectsBenchClient";
import { loadProject } from "@/lib/server-projects";

export default async function SelectsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await loadProject(slug);
  if (!project) notFound();
  return <SelectsBenchClient slug={slug} fallbackProject={project} />;
}
