import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";
import { PageContainer } from "@/components/shell/page";
import { fetchTasks } from "@/features/organizer/queries";
import { ProjectDetail } from "@/features/projects/project-detail";
import type { ProjectNote } from "@/features/projects/actions";
import { requireContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { todayInTimeZone } from "@/lib/utils";
import type { ConversationSummary, Project } from "@/lib/types";
import Loading from "../../loading";

export const metadata: Metadata = { title: "Projeto" };

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Loading />}>
      <ProjectPage params={params} />
    </Suspense>
  );
}

async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, goal, status, completed_at, created_at, updated_at")
    .eq("id", id.data)
    .maybeSingle();
  if (!project) notFound();

  const [tasks, notesResult, conversationsResult] = await Promise.all([
    fetchTasks(supabase, { projectId: project.id }),
    supabase
      .from("project_notes")
      .select("id, content, created_at")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("conversations")
      .select("id, title, last_message_at")
      .eq("project_id", project.id)
      .order("last_message_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <PageContainer>
      <Link href="/app/projetos" className="mb-4 inline-flex min-h-9 items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" />
        Todos os projetos
      </Link>
      <ProjectDetail
        key={project.id}
        project={project as Project}
        tasks={tasks}
        notes={(notesResult.data ?? []) as ProjectNote[]}
        conversations={(conversationsResult.data ?? []) as ConversationSummary[]}
        today={todayInTimeZone(ctx.profile.timezone)}
      />
    </PageContainer>
  );
}
