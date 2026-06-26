import { redirect } from "next/navigation";
import { loadProject } from "@/lib/server-projects";

export default async function ProjectRoot({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await loadProject(slug);
  if (!project) redirect("/projects");
  redirect(`/projects/${slug}/screening/${project.reels[0].id}`);
}
