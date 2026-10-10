import { getPlan, type PlanId, type QuotaKind } from "@/lib/plans";

export type UsageSnapshot = Record<QuotaKind, { used: number; limit: number }>;

export function emptyUsage(plan: PlanId): UsageSnapshot {
  const def = getPlan(plan);
  return {
    mensagem: { used: 0, limit: def.limits.dailyMessages },
    geracao: { used: 0, limit: def.limits.dailyGenerations },
    arquivo: { used: 0, limit: def.limits.dailyFiles },
  };
}
