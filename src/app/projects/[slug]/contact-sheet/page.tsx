import { notFound } from "next/navigation";
import { ContactSheetClient } from "@/components/ContactSheetClient";
import { loadProject } from "@/lib/server-projects";

export default async function ContactSheetPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await loadProject(slug);
  if (!project) notFound();
  return <ContactSheetClient slug={slug} fallbackProject={project} />;
}
