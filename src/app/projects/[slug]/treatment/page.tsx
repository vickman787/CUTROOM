import { notFound } from "next/navigation";
import { TreatmentClient } from "@/components/TreatmentClient";
import { loadProject } from "@/lib/server-projects";

export default async function TreatmentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await loadProject(slug);
  if (!project) notFound();
  return <TreatmentClient slug={slug} fallbackProject={project} />;
}
