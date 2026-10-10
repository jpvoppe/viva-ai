import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Flame } from "lucide-react";
import { Orb } from "@/components/orb/orb";
import { PageContainer, SectionTitle } from "@/components/shell/page";
import { Alert, Progress } from "@/components/ui/feedback";
import { CommandField, TodayTasks, type Shortcut } from "@/features/home/home-client";
import { TASK_COLUMNS } from "@/features/organizer/schema";
import { requireContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { todayInTimeZone } from "@/lib/utils";
import type { Stats, Task } from "@/lib/types";
import Loading from "./loading";

export const metadata: Metadata = { title: "Início" };

export default function Page({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  return (
    <Suspense fallback={<Loading />}>
      <Home searchParams={searchParams} />
    </Suspense>
  );
}

const BASE_SHORTCUTS: (Shortcut & { goals: string[] })[] = [
  { id: "explicar", label: "Explique algo que não entendi", prompt: "Quero entender melhor um assunto. O assunto é: ", goals: ["estudar"] },
  { id: "semana", label: "Organize minha semana", prompt: "Me ajude a organizar a minha semana. Estes são os meus compromissos e tarefas: ", goals: ["organizar", "trabalho"] },
  { id: "conteudo", label: "Crie um conteúdo para mim", href: "/app/criar", goals: ["criar"] },
  { id: "estudos", label: "Monte um plano de estudos", href: "/app/criar/plano-de-estudos", goals: ["estudar"] },
  { id: "viagem", label: "Ajude-me a planejar uma viagem", href: "/app/criar/viagem", goals: ["dia_a_dia"] },
  { id: "projeto", label: "Transforme uma ideia em um projeto", href: "/app/projetos?novo=1", goals: ["projetos", "trabalho"] },
];

function greetingFor(timeZone: string, now: Date): string {
  let hour = 12;
  try {
    hour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false }).format(now)) % 24;
  } catch {
    hour = 12;
  }
  if (hour < 5) return "Boa madrugada";
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

async function Home({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const ctx = await requireContext();
  const { aviso } = await searchParams;
  const supabase = await createClient();
  const today = todayInTimeZone(ctx.profile.timezone);

  const [tasksResult, projectsResult, conversationsResult, statsResult] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .is("completed_at", null)
      .lte("due_date", today)
      .order("due_date", { ascending: true })
      .limit(8),
    supabase
      .from("projects")
      .select("id, name, tasks(id, completed_at)")
      .eq("status", "ativo")
      .order("updated_at", { ascending: false })
      .limit(3),
    supabase.from("conversations").select("id, title").order("last_message_at", { ascending: false }).limit(3),
    ctx.preferences.gamification_enabled ? supabase.rpc("my_stats") : Promise.resolve({ data: null }),
  ]);

  const tasks = (tasksResult.data ?? []) as Task[];
  const projects = (projectsResult.data ?? []).map((p) => {
    const all = (p.tasks ?? []) as { id: string; completed_at: string | null }[];
    return { id: p.id as string, name: p.name as string, total: all.length, done: all.filter((t) => t.completed_at).length };
  });
  const conversations = conversationsResult.data ?? [];
  const stats = (statsResult.data ?? null) as Stats | null;
  const projectNames = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  // Atalhos: os que combinam com os objetivos escolhidos vêm primeiro.
  const goals = new Set(ctx.preferences.goals);
  const shortcuts = BASE_SHORTCUTS.slice().sort(
    (a, b) => Number(b.goals.some((g) => goals.has(g))) - Number(a.goals.some((g) => goals.has(g))),
  );

  const name = ctx.profile.display_name.split(" ")[0];
  const weeklyGoal = ctx.preferences.weekly_task_goal;

  return (
    <PageContainer>
      {aviso === "senha-alterada" ? (
        <Alert tone="sucesso" title="Senha alterada." className="mb-6">
          Use a nova senha na próxima vez que entrar.
        </Alert>
      ) : null}

      <section aria-labelledby="pergunta" className="pt-2 lg:pt-8">
        <div className="flex items-center gap-3">
          <Orb size={36} />
          <p className="text-ink-soft">
            {greetingFor(ctx.profile.timezone, new Date())}
            {name ? `, ${name}` : ""}.
          </p>
        </div>
        <h1 id="pergunta" className="mb-6 mt-4 text-4xl sm:text-5xl" style={{ fontStretch: "86%" }}>
          O que vamos resolver hoje?
        </h1>
        <CommandField shortcuts={shortcuts} />
      </section>

      {tasks.length > 0 ? (
        <section className="mt-12" aria-label="Tarefas para hoje">
          <SectionTitle
            action={
              <Link href="/app/organizador" className="text-sm font-medium text-violet-text underline underline-offset-4">
                Abrir organizador
              </Link>
            }
          >
            Para hoje
          </SectionTitle>
          <TodayTasks tasks={tasks} today={today} projectNames={projectNames} />
        </section>
      ) : null}

      {projects.length > 0 ? (
        <section className="mt-12" aria-label="Projetos ativos">
          <SectionTitle
            action={
              <Link href="/app/projetos" className="text-sm font-medium text-violet-text underline underline-offset-4">
                Ver todos os projetos
              </Link>
            }
          >
            Projetos em andamento
          </SectionTitle>
          <ul className="flex flex-col">
            {projects.map((project) => (
              <li key={project.id} className="border-b border-line last:border-b-0">
                <Link href={`/app/projetos/${project.id}`} className="block py-3 hover:text-violet-text">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-medium">{project.name}</span>
                    <span className="shrink-0 text-sm tabular-nums text-ink-muted">
                      {project.total === 0 ? "sem etapas" : `${project.done} de ${project.total} etapas`}
                    </span>
                  </span>
                  {project.total > 0 ? (
                    <Progress className="mt-2" value={project.done} max={project.total} label={`Progresso de ${project.name}`} />
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {conversations.length > 0 ? (
        <section className="mt-12" aria-label="Conversas recentes">
          <SectionTitle
            action={
              <Link href="/app/historico" className="text-sm font-medium text-violet-text underline underline-offset-4">
                Ver histórico
              </Link>
            }
          >
            Continuar de onde parou
          </SectionTitle>
          <ul>
            {conversations.map((conversation) => (
              <li key={conversation.id} className="border-b border-line last:border-b-0">
                <Link
                  href={`/app/assistente/${conversation.id}`}
                  className="flex min-h-12 items-center py-2 hover:text-violet-text"
                >
                  <span className="truncate">{conversation.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {stats && (stats.dias_ativos_semana > 0 || weeklyGoal) ? (
        <section className="mt-12" aria-label="Sua semana">
          <SectionTitle
            action={
              <Link href="/app/configuracoes?aba=progresso" className="text-sm font-medium text-violet-text underline underline-offset-4">
                Ver progresso
              </Link>
            }
          >
            Sua semana
          </SectionTitle>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-ink-muted">Dias ativos</dt>
              <dd className="font-display text-2xl font-semibold tabular-nums">{stats.dias_ativos_semana} de 7</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Tarefas concluídas</dt>
              <dd className="font-display text-2xl font-semibold tabular-nums">
                {stats.tarefas_semana}
                {weeklyGoal ? <span className="text-base font-normal text-ink-muted"> de {weeklyGoal}</span> : null}
              </dd>
            </div>
            {stats.sequencia_atual >= 2 ? (
              <div>
                <dt className="text-sm text-ink-muted">Sequência</dt>
                <dd className="flex items-center gap-1.5 font-display text-2xl font-semibold tabular-nums">
                  <Flame aria-hidden="true" className="size-5 text-warning" />
                  {stats.sequencia_atual} dias
                </dd>
              </div>
            ) : null}
          </dl>
          {weeklyGoal ? (
            <Progress className="mt-4" value={stats.tarefas_semana} max={weeklyGoal} label="Meta semanal de tarefas" />
          ) : null}
        </section>
      ) : null}
    </PageContainer>
  );
}
