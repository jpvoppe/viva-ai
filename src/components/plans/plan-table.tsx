import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { FAMILY_MAX_PEOPLE, PLANS, type PlanId } from "@/lib/plans";
import { cn, formatBytes } from "@/lib/utils";

function features(id: PlanId): string[] {
  const l = PLANS[id].limits;
  const base = [
    `${l.dailyMessages} mensagens ao assistente por dia`,
    `${l.dailyGenerations} criações nas ferramentas por dia`,
    `${l.dailyFiles} arquivos por dia, de até ${formatBytes(l.maxFileBytes)} cada`,
    l.maxOutputTokens > 2000 ? "Respostas mais longas" : "Respostas de tamanho padrão",
    `Até ${l.maxActiveProjects} projetos ativos`,
    `Memória personalizada com até ${l.maxMemories} itens`,
    "Organizador, histórico e conversor sem limite",
  ];
  if (id === "familia") {
    return [`Para até ${FAMILY_MAX_PEOPLE} pessoas, cada uma com seus dados privados`, ...base.slice(0, 4), "Gestão de membros pelo responsável"];
  }
  return base;
}

/**
 * Comparação dos planos. Os limites vêm de src/lib/plans.ts (os mesmos que o
 * servidor aplica) e o preço vem do Stripe — nada aqui é digitado à mão.
 */
export function PlanTable({
  prices,
  current,
  actions,
}: {
  prices: { plus: string | null; familia: string | null };
  current?: PlanId;
  actions?: Partial<Record<PlanId, ReactNode>>;
}) {
  const priceLabel: Record<PlanId, string> = {
    gratuito: "Grátis",
    plus: prices.plus ?? "Preço a definir",
    familia: prices.familia ?? "Preço a definir",
  };
  return (
    <ul className="grid gap-4 lg:grid-cols-3">
      {(Object.keys(PLANS) as PlanId[]).map((id) => {
        const plan = PLANS[id];
        const isCurrent = current === id;
        return (
          <li
            key={id}
            className={cn(
              "flex flex-col rounded-lg border bg-surface p-5",
              id === "plus" ? "border-violet shadow-2" : "border-line",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xl">{plan.name}</h3>
              {isCurrent ? (
                <span className="rounded-full bg-tint px-2.5 py-0.5 text-sm font-medium text-violet-text">Seu plano</span>
              ) : null}
            </div>
            <p className="mt-1 min-h-12 text-ink-soft">{plan.tagline}</p>
            <p className="mt-3 font-display text-2xl font-semibold">{priceLabel[id]}</p>
            <ul className="mt-4 flex flex-1 flex-col gap-2">
              {features(id).map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-ink-soft">
                  <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-success" strokeWidth={3} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            {actions?.[id] ? <div className="mt-5">{actions[id]}</div> : null}
          </li>
        );
      })}
    </ul>
  );
}
