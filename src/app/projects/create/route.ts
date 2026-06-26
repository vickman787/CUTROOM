import { NextRequest, NextResponse } from "next/server";
import { createProject } from "@/lib/create-project";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const project = await createProject({
    title: formData.get("title")?.toString() ?? "",
    logline: formData.get("logline")?.toString() ?? "",
    director: formData.get("director")?.toString() ?? "",
    productionCompany: formData.get("productionCompany")?.toString() ?? "",
    shotAround: formData.get("shotAround")?.toString() ?? "",
  });

  return NextResponse.redirect(
    new URL(`/projects/${project.slug}/screening/${project.reels[0].id}`, req.url),
    303,
  );
}
