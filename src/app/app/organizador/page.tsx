import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { OrganizerClient } from "@/features/organizer/organizer-client";
import { fetchGoals, fetchLists, fetchProjectOptions, fetchTasks } from "@/features/organizer/queries";
import { requireContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { todayInTimeZone } from "@/lib/utils";
import Loading from "../loading";

export const metadata: Metadata = { title: "Organizador" };

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Organizer />
    </Suspense>
  );
}

async function Organizer() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const [tasks, lists, goals, projects] = await Promise.all([
    fetchTasks(supabase),
    fetchLists(supabase),
    fetchGoals(supabase),
    fetchProjectOptions(supabase),
  ]);
  return (
    <PageContainer>
      <PageHeader title="Organizador" description="Tarefas, calendário, listas e objetivos em um só lugar." />
      <OrganizerClient
        today={todayInTimeZone(ctx.profile.timezone)}
        tasks={tasks}
        lists={lists}
        goals={goals}
        projects={projects}
      />
    </PageContainer>
  );
}
