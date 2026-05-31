import { NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/db";

export function GET() {
  return NextResponse.json({ projects: listProjects() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const project = createProject(body.name ?? "Doorframe Demo");

  return NextResponse.json({ project }, { status: 201 });
}
