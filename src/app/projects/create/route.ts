import { NextRequest, NextResponse } from "next/server";
import { createProject } from "@/lib/create-project";
import { requireUserId } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const ownerId = await requireUserId();
  const project = await createProject({
    title: formData.get("title")?.toString() ?? "",
    logline: formData.get("logline")?.toString() ?? "",
    director: formData.get("director")?.toString() ?? "",
    productionCompany: formData.get("productionCompany")?.toString() ?? "",
    shotAround: formData.get("shotAround")?.toString() ?? "",
  }, ownerId);

  return NextResponse.redirect(
    new URL(`/projects/${project.slug}/screening/${project.reels[0].id}`, req.url),
    303,
  );
}
