import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { estimateCostMicroUsd } from "./pricing";

export type UsageRecord = {
  userId: string;
  feature: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  status: "ok" | "interrompida" | "erro";
};

/** Grava o consumo de uma chamada de IA (tokens e custo estimado). */
export async function recordUsage(record: UsageRecord): Promise<void> {
  try {
    await createAdminClient()
      .from("usage_events")
      .insert({
        user_id: record.userId,
        feature: record.feature.slice(0, 40),
        provider: record.provider,
        model: record.model,
        input_tokens: record.inputTokens,
        output_tokens: record.outputTokens,
        cost_micro_usd: estimateCostMicroUsd(record.model, record.inputTokens, record.outputTokens),
        status: record.status,
      });
    budgetCache = null;
  } catch (error) {
    console.error("[viva:ia] falha ao registrar consumo", error instanceof Error ? error.message : error);
  }
}

let budgetCache: { at: number; spentMicroUsd: number } | null = null;

export type BudgetStatus = { limited: boolean; budgetUsd: number | null; spentUsd: number };

/**
 * Trava global de gastos: se AI_ORCAMENTO_DIARIO_USD estiver definido e o
 * custo estimado das últimas 24h passar dele, novas chamadas são recusadas.
 */
export async function getBudgetStatus(): Promise<BudgetStatus> {
  const budgetUsd = serverEnv.aiDailyBudgetUsd ?? null;
  if (budgetUsd === null) return { limited: false, budgetUsd: null, spentUsd: 0 };

  const now = Date.now();
  if (!budgetCache || now - budgetCache.at > 30_000) {
    const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await createAdminClient().rpc("ai_spend_since", { p_since: since });
    const sum = error ? 0 : Number(data ?? 0);
    budgetCache = { at: now, spentMicroUsd: sum };
  }
  const spentUsd = budgetCache.spentMicroUsd / 1_000_000;
  return { limited: spentUsd >= budgetUsd, budgetUsd, spentUsd };
}
