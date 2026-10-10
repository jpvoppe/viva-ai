import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlan, quotaLimit, type PlanId, type QuotaKind } from "@/lib/plans";
import { todayInTimeZone } from "@/lib/utils";

export type QuotaResult = { allowed: boolean; used: number; limit: number; period: string };

/**
 * Consome 1 unidade da cota diária do usuário, no banco, de forma atômica.
 * Só o servidor chama (chave de serviço); o navegador não consegue alterar o contador.
 */
export async function consumeQuota(
  userId: string,
  plan: PlanId,
  kind: QuotaKind,
  timeZone: string,
): Promise<QuotaResult> {
  const limit = quotaLimit(getPlan(plan), kind);
  const period = todayInTimeZone(timeZone);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_quota", {
    p_user: userId,
    p_kind: kind,
    p_period: period,
    p_limit: limit,
  });
  if (error) throw new Error(`consume_quota: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return { allowed: Boolean(row?.allowed), used: Number(row?.used ?? 0), limit, period };
}

/** Devolve a unidade quando a operação falhou antes de gerar custo. */
export async function refundQuota(userId: string, kind: QuotaKind, period: string): Promise<void> {
  const admin = createAdminClient();
  await admin.rpc("refund_quota", { p_user: userId, p_kind: kind, p_period: period });
}

export { emptyUsage, type UsageSnapshot } from "./usage-snapshot";
