import { notFound } from "next/navigation";
import { EnvBanner } from "@/components/EnvBanner";
import { ProjectHydrator } from "@/components/ProjectHydrator";
import { ProjectNav } from "@/components/ProjectNav";
import { ReelHeader } from "@/components/ReelHeader";
import { loadProject } from "@/lib/server-projects";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await loadProject(slug);
  if (!project) notFound();

  return (
    <div className="min-h-screen bg-paper text-ink">
      <ReelHeader
        projectSlug={project.slug}
        trail={[
          { href: "/", label: "Opening" },
          { href: "/projects", label: "Shelf" },
          { href: `/projects/${project.slug}/screening/${project.reels[0]?.id ?? ""}`, label: project.title, current: true },
        ]}
      />
      <EnvBanner />
      <ProjectNav slug={project.slug} reelId={project.reels[0]?.id} />
      <ProjectHydrator project={project} />
      {children}
    </div>
  );
}
