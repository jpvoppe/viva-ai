import "server-only";
import { getSessionUser, getUserContext, type SessionUser } from "@/lib/auth/session";
import { apiError, isSameOrigin } from "@/lib/api/respond";
import { checkRateLimit, type RateRule } from "@/lib/limits/rate-limit";
import { consumeQuota, type QuotaResult } from "@/lib/limits/quota";
import { isServiceRoleConfigured } from "@/lib/env";
import { getPlan, type PlanDefinition, type QuotaKind } from "@/lib/plans";
import { getAiSetup, type AiSetup } from "@/lib/ai";
import { getBudgetStatus } from "@/lib/ai/usage";
import { logError } from "@/lib/log";
import type { UserContext } from "@/lib/types";

export type AiGuard = {
  user: SessionUser;
  ctx: UserContext;
  plan: PlanDefinition;
  ai: Extract<AiSetup, { configured: true }>;
};

/**
 * Verificações comuns a toda rota que chama a IA, sempre na mesma ordem:
 * origem → sessão → recurso habilitado → limite de requisições → IA configurada → orçamento.
 * Devolve uma Response de erro pronta ou os dados para seguir.
 */
export async function guardAiRequest(
  request: Request,
  options: { flag: string; flagMessage: string; rateKey: string; rateRule: RateRule },
): Promise<AiGuard | Response> {
  if (!isSameOrigin(request)) return apiError("requisicao_invalida", "Origem não permitida.", { status: 403 });

  const user = await getSessionUser();
  if (!user) return apiError("sessao_expirada", "Sua sessão expirou. Entre de novo para continuar.");
  const ctx = await getUserContext();
  if (!ctx) return apiError("sessao_expirada", "Sua sessão expirou. Entre de novo para continuar.");

  if (ctx.flags[options.flag] === false) return apiError("recurso_desativado", options.flagMessage);

  if (!(await checkRateLimit(`${options.rateKey}:${user.id}`, options.rateRule))) {
    return apiError("muitas_requisicoes", "Muitos pedidos em pouco tempo. Aguarde um minuto e tente de novo.", {
      retryable: true,
    });
  }

  const ai = getAiSetup();
  if (!ai.configured || !isServiceRoleConfigured()) {
    return apiError(
      "ia_nao_configurada",
      "A IA ainda não foi configurada neste ambiente. O administrador precisa informar a chave do provedor.",
    );
  }

  const budget = await getBudgetStatus();
  if (budget.limited) {
    await logError("ia.orcamento", "Orçamento diário de IA atingido", "orcamento_esgotado");
    return apiError("orcamento_esgotado", "O VIVA atingiu o limite de uso de IA de hoje. Tente de novo mais tarde.", {
      retryable: true,
    });
  }

  return { user, ctx, plan: getPlan(ctx.plan), ai };
}

const QUOTA_NAMES: Record<QuotaKind, string> = {
  mensagem: "mensagens",
  geracao: "criações",
  arquivo: "arquivos",
};

/** Consome a cota do plano ou devolve a resposta de limite atingido. */
export async function guardQuota(guard: AiGuard, kind: QuotaKind): Promise<QuotaResult | Response> {
  const quota = await consumeQuota(guard.user.id, guard.ctx.plan, kind, guard.ctx.profile.timezone);
  if (quota.allowed) return quota;
  return apiError(
    "limite_plano",
    guard.ctx.plan === "gratuito"
      ? `Você usou as ${quota.limit} ${QUOTA_NAMES[kind]} de hoje do plano Gratuito. O limite volta amanhã — ou conheça o VIVA Plus.`
      : `Você usou as ${quota.limit} ${QUOTA_NAMES[kind]} de hoje do seu plano. O limite volta amanhã.`,
    { usage: { used: quota.used, limit: quota.limit } },
  );
}
