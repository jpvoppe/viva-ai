import { Suspense } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { DailyCallsChart, FeatureFlags, type DailyUsage, type Flag } from "@/features/admin/admin-widgets";
import { formatUsd } from "@/features/admin/format";
import { requireAdmin } from "@/lib/auth/session";
import { getAiSetup } from "@/lib/ai";
import { priceFor } from "@/lib/ai/pricing";
import { isServiceRoleConfigured, isStripeConfigured, serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4" role="status">
          <span className="sr-only">Carregando o painel…</span>
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-28" />
          <Skeleton className="h-64" />
        </div>
      }
    >
      <AdminPanel />
    </Suspense>
  );
}

type Overview = {
  usuarios_total: number;
  usuarios_novos_7d: number;
  ativos_1d: number;
  ativos_7d: number;
  ativos_30d: number;
  assinaturas: { plano: string; status: string; total: number }[];
  ia_30d: { chamadas: number; tokens_entrada: number; tokens_saida: number; custo_micro_usd: number; chamadas_sem_preco: number; erros: number };
  ia_hoje: { chamadas: number; custo_micro_usd: number };
  erros_24h: number;
  avaliacoes_30d: { positivas: number; negativas: number };
  cobranca_eventos_erro_7d: number;
};

const FEATURE_LABEL: Record<string, string> = {
  mensagem_enviada: "Mensagens ao assistente",
  tarefa_concluida: "Tarefas concluídas",
  projeto_criado: "Projetos criados",
  projeto_concluido: "Projetos concluídos",
  cartao_revisado: "Cartões revisados",
  quiz_concluido: "Questionários respondidos",
  criacao_salva: "Criações salvas",
  objetivo_concluido: "Objetivos alcançados",
};

const n = (value: number) => Number(value ?? 0).toLocaleString("pt-BR");

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="font-display text-2xl font-semibold tabular-nums">{value}</dd>
      {hint ? <dd className="text-sm text-ink-muted">{hint}</dd> : null}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-8">
      <h2 className="text-xl">{title}</h2>
      {description ? <p className="mt-1 max-w-prose text-ink-soft">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function dateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

/**
 * Painel administrativo. Só números agregados: nenhuma consulta daqui lê
 * conteúdo de conversa, arquivo ou tarefa de usuário.
 */
async function AdminPanel() {
  await requireAdmin();
  const supabase = await createClient();
  const [overviewRes, dailyRes, featuresRes, errorsRes, feedbackRes, billingRes, flagsRes, auditRes] = await Promise.all([
    supabase.rpc("admin_overview"),
    supabase.rpc("admin_usage_daily", { p_days: 30 }),
    supabase.rpc("admin_feature_usage", { p_days: 30 }),
    supabase.rpc("admin_recent_errors", { p_limit: 20 }),
    supabase.rpc("admin_feedback", { p_limit: 20 }),
    supabase.rpc("admin_billing_events", { p_limit: 15 }),
    supabase.from("feature_flags").select("key, enabled, description").order("key"),
    supabase.rpc("admin_audit", { p_limit: 15 }),
  ]);

  if (overviewRes.error || !overviewRes.data) {
    return <Alert tone="erro" title="Não foi possível carregar o painel.">Confira se as migrações do banco foram aplicadas.</Alert>;
  }

  const overview = overviewRes.data as Overview;
  const daily = ((dailyRes.data ?? []) as DailyUsage[]).map((d) => ({
    ...d,
    chamadas: Number(d.chamadas),
    tokens_entrada: Number(d.tokens_entrada),
    tokens_saida: Number(d.tokens_saida),
    custo_micro_usd: Number(d.custo_micro_usd),
    usuarios: Number(d.usuarios),
  }));
  const features = (featuresRes.data ?? []) as { recurso: string; eventos: number; usuarios: number }[];
  const errors = (errorsRes.data ?? []) as { id: number; scope: string; code: string | null; message: string; created_at: string }[];
  const feedback = (feedbackRes.data ?? []) as { id: string; category: string; comment: string; created_at: string }[];
  const billing = (billingRes.data ?? []) as { id: number; type: string; status: string; detail: string | null; created_at: string }[];
  const audit = (auditRes.data ?? []) as { id: number; action: string; detail: string | null; created_at: string }[];

  const ai = getAiSetup();
  const budget = serverEnv.aiDailyBudgetUsd ?? null;
  const spentTodayUsd = overview.ia_hoje.custo_micro_usd / 1_000_000;
  const modelPriced = ai.configured ? priceFor(ai.defaultModel) !== null : false;
  const votes = overview.avaliacoes_30d.positivas + overview.avaliacoes_30d.negativas;

  const health = [
    { ok: true, label: "Banco de dados", detail: "respondeu às consultas deste painel" },
    { ok: isServiceRoleConfigured(), label: "Chave de serviço", detail: isServiceRoleConfigured() ? "configurada" : "ausente: limites e cobrança não funcionam" },
    {
      ok: ai.configured && !(ai.configured && ai.simulated),
      label: "Provedor de IA",
      detail: ai.configured
        ? ai.simulated
          ? "IA SIMULADA em uso (modo de teste)"
          : `${ai.provider.id}, modelo padrão ${ai.defaultModel}${ai.advancedModel ? `, avançado ${ai.advancedModel}` : ""}`
        : ai.reason,
    },
    { ok: isStripeConfigured() && Boolean(serverEnv.stripeWebhookSecret), label: "Pagamentos", detail: isStripeConfigured() ? (serverEnv.stripeWebhookSecret ? "Stripe configurado" : "falta STRIPE_WEBHOOK_SECRET") : "Stripe não configurado" },
    { ok: budget !== null, label: "Trava de orçamento diário de IA", detail: budget !== null ? `US$ ${budget.toFixed(2)} por dia` : "não definida (AI_ORCAMENTO_DIARIO_USD)" },
  ];

  return (
    <>
      <h1 className="text-3xl">Painel administrativo</h1>
      <p className="mt-1.5 max-w-prose text-ink-soft">
        Números agregados do VIVA. O conteúdo das conversas e dos arquivos dos usuários não aparece aqui.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {budget !== null && spentTodayUsd >= budget ? (
          <Alert tone="erro" title="Orçamento diário de IA atingido: novas chamadas estão sendo recusadas.">
            Gasto estimado nas últimas 24 h: US$ {spentTodayUsd.toFixed(2)} de US$ {budget.toFixed(2)}.
          </Alert>
        ) : budget !== null && spentTodayUsd >= budget * 0.8 ? (
          <Alert tone="atencao" title="Gasto de IA acima de 80% do orçamento diário.">
            US$ {spentTodayUsd.toFixed(2)} de US$ {budget.toFixed(2)} nas últimas 24 h.
          </Alert>
        ) : null}
        {ai.configured && !modelPriced ? (
          <Alert tone="atencao" title="O modelo em uso não tem preço configurado.">
            O custo aparece como zero e a trava de orçamento não enxerga esse gasto. Defina AI_PRECOS_JSON.
          </Alert>
        ) : null}
        {overview.cobranca_eventos_erro_7d > 0 ? (
          <Alert tone="erro" title={`${overview.cobranca_eventos_erro_7d} avisos de cobrança falharam nos últimos 7 dias.`}>
            Veja a lista em “Cobrança” e confira o painel do Stripe.
          </Alert>
        ) : null}
      </div>

      <section className="py-8">
        <h2 className="sr-only">Visão geral</h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
          <Stat label="Contas" value={n(overview.usuarios_total)} hint={`${n(overview.usuarios_novos_7d)} novas em 7 dias`} />
          <Stat label="Ativos hoje" value={n(overview.ativos_1d)} hint="últimas 24 h" />
          <Stat label="Ativos em 7 dias" value={n(overview.ativos_7d)} />
          <Stat label="Ativos em 30 dias" value={n(overview.ativos_30d)} />
        </dl>
      </section>

      <Section title="Consumo de IA" description="Custo estimado pelos tokens de cada chamada e pela tabela de preços configurada. Confira com a fatura do provedor.">
        <dl className="mb-8 grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
          <Stat label="Custo em 30 dias" value={formatUsd(overview.ia_30d.custo_micro_usd)} hint={overview.ia_30d.chamadas_sem_preco > 0 ? `${n(overview.ia_30d.chamadas_sem_preco)} chamadas sem preço` : undefined} />
          <Stat label="Custo nas últimas 24 h" value={formatUsd(overview.ia_hoje.custo_micro_usd)} hint={`${n(overview.ia_hoje.chamadas)} chamadas`} />
          <Stat label="Chamadas em 30 dias" value={n(overview.ia_30d.chamadas)} hint={`${n(overview.ia_30d.erros)} com erro`} />
          <Stat
            label="Custo por usuário ativo (30 d)"
            value={overview.ativos_30d > 0 ? formatUsd(overview.ia_30d.custo_micro_usd / overview.ativos_30d) : "sem dados"}
          />
        </dl>
        <DailyCallsChart data={daily} />
        <details className="mt-4">
          <summary className="inline-flex min-h-11 items-center font-medium text-violet-text underline underline-offset-4">
            Ver a tabela dia a dia
          </summary>
          <div className="mt-2 overflow-x-auto rounded-md border border-line">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-sunken">
                <tr>
                  {["Dia", "Chamadas", "Usuários", "Tokens de entrada", "Tokens de saída", "Custo estimado"].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {daily
                  .slice()
                  .reverse()
                  .map((d) => (
                    <tr key={d.dia} className="border-t border-line tabular-nums">
                      <th scope="row" className="px-3 py-2 font-normal">{d.dia.split("-").reverse().join("/")}</th>
                      <td className="px-3 py-2">{n(d.chamadas)}</td>
                      <td className="px-3 py-2">{n(d.usuarios)}</td>
                      <td className="px-3 py-2">{n(d.tokens_entrada)}</td>
                      <td className="px-3 py-2">{n(d.tokens_saida)}</td>
                      <td className="px-3 py-2">{formatUsd(d.custo_micro_usd)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
      </Section>

      <Section title="Assinaturas">
        {overview.assinaturas.length === 0 ? (
          <p className="text-ink-muted">Nenhuma conta ainda.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full text-left">
              <thead className="bg-sunken text-sm">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">Plano</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Situação</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Contas</th>
                </tr>
              </thead>
              <tbody>
                {overview.assinaturas.map((row) => (
                  <tr key={`${row.plano}-${row.status}`} className="border-t border-line">
                    <td className="px-3 py-2">{row.plano}</td>
                    <td className="px-3 py-2">{row.status}</td>
                    <td className="px-3 py-2 tabular-nums">{n(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Uso de funcionalidades" description="Eventos registrados nos últimos 30 dias.">
        {features.length === 0 ? (
          <p className="text-ink-muted">Sem atividade registrada no período.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full text-left">
              <thead className="bg-sunken text-sm">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">Funcionalidade</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Eventos</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Usuários</th>
                </tr>
              </thead>
              <tbody>
                {features.map((row) => (
                  <tr key={row.recurso} className="border-t border-line">
                    <td className="px-3 py-2">{FEATURE_LABEL[row.recurso] ?? row.recurso}</td>
                    <td className="px-3 py-2 tabular-nums">{n(row.eventos)}</td>
                    <td className="px-3 py-2 tabular-nums">{n(row.usuarios)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-ink-soft">
          Avaliações das respostas em 30 dias:{" "}
          {votes === 0
            ? "nenhuma ainda."
            : `${n(overview.avaliacoes_30d.positivas)} positivas e ${n(overview.avaliacoes_30d.negativas)} negativas (${Math.round((overview.avaliacoes_30d.positivas / votes) * 100)}% positivas).`}
        </p>
      </Section>

      <Section title="Saúde do sistema">
        <ul className="flex flex-col gap-2">
          {health.map((item) => (
            <li key={item.label} className="flex items-start gap-2.5">
              {item.ok ? (
                <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
              ) : (
                <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
              )}
              <span>
                <span className="font-medium">{item.label}:</span> <span className="text-ink-soft">{item.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`Erros técnicos (${n(overview.erros_24h)} nas últimas 24 h)`} description="Mensagens técnicas, sem conteúdo de usuário.">
        {errors.length === 0 ? (
          <p className="text-ink-muted">Nenhum erro registrado.</p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line">
            {errors.map((error) => (
              <li key={error.id} className="px-3 py-2.5">
                <p className="text-sm text-ink-muted">
                  {dateTime(error.created_at)}, {error.scope}
                  {error.code ? ` (${error.code})` : ""}
                </p>
                <p className="break-words font-mono text-sm">{error.message}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Cobrança" description="Últimos avisos recebidos do Stripe.">
        {billing.length === 0 ? (
          <p className="text-ink-muted">Nenhum aviso de cobrança recebido.</p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line">
            {billing.map((event) => (
              <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-4 px-3 py-2.5">
                <span>
                  <span className="font-mono text-sm">{event.type}</span>
                  {event.detail ? <span className="text-ink-soft"> — {event.detail}</span> : null}
                </span>
                <span className="text-sm text-ink-muted">
                  {event.status}, {dateTime(event.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Mensagens dos usuários" description="Enviadas voluntariamente pelo formulário “Fale com a gente”. Não mostramos quem enviou.">
        {feedback.length === 0 ? (
          <p className="text-ink-muted">Nenhuma mensagem recebida.</p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line">
            {feedback.map((item) => (
              <li key={item.id} className="px-3 py-2.5">
                <p className="text-sm text-ink-muted">
                  {dateTime(item.created_at)}, {item.category}
                </p>
                <p className="whitespace-pre-wrap">{item.comment}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Recursos habilitados" description="Desligar um recurso vale para todos os usuários, na hora. Cada mudança fica registrada.">
        <div className="max-w-2xl">
          <FeatureFlags flags={(flagsRes.data ?? []) as Flag[]} />
        </div>
      </Section>

      <Section title="Registro de ações administrativas">
        {audit.length === 0 ? (
          <p className="text-ink-muted">Nenhuma ação registrada.</p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line">
            {audit.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-4 px-3 py-2.5">
                <span>
                  {entry.action}
                  {entry.detail ? <span className="text-ink-soft">: {entry.detail}</span> : null}
                </span>
                <span className="text-sm text-ink-muted">{dateTime(entry.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
