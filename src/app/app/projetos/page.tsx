import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { ProjectsClient, type ProjectSummary } from "@/features/projects/projects-client";
import { requireContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import Loading from "../loading";

export const metadata: Metadata = { title: "Projetos" };

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Projects />
    </Suspense>
  );
}

async function Projects() {
  await requireContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, name, goal, status, tasks(id, completed_at)")
    .order("updated_at", { ascending: false })
    .limit(200);
  const projects: ProjectSummary[] = (data ?? []).map((p) => {
    const tasks = (p.tasks ?? []) as { completed_at: string | null }[];
    return {
      id: p.id,
      name: p.name,
      goal: p.goal,
      status: p.status,
      total: tasks.length,
      done: tasks.filter((t) => t.completed_at).length,
    };
  });
  return (
    <PageContainer>
      <PageHeader title="Projetos" description="Transforme ideias em etapas e acompanhe o que já avançou." />
      <ProjectsClient projects={projects} />
    </PageContainer>
  );
}
