import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProjectChrome } from "@/components/project/ProjectChrome";
import { ProjectProvider } from "@/components/project/ProjectProvider";
import { getSession } from "@/lib/server/auth";
import { getProjectForUser } from "@/lib/server/projects";
import { PRIVATE } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const session = await getSession();
  if (!session) return { robots: PRIVATE };
  const p = await getProjectForUser({ id: session.userId, name: session.name }, (await params).id).catch(() => null);
  return { title: p?.project.name ?? "Project", robots: PRIVATE };
}

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const data = await getProjectForUser({ id: session.userId, name: session.name }, id);
  if (!data) notFound();
  return (
    <ProjectProvider initial={data.project} collab={data.collab}>
      <ProjectChrome>{children}</ProjectChrome>
    </ProjectProvider>
  );
}
