import "server-only";
import { serverEnv } from "@/lib/env";
import { getPlan, type PlanId } from "@/lib/plans";
import { createAnthropicProvider } from "./providers/anthropic";
import { createOpenAiCompatProvider } from "./providers/openai-compat";
import { createMockProvider } from "./providers/mock";
import type { AiProvider } from "./types";

export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

export type AiSetup =
  | { configured: true; provider: AiProvider; simulated: boolean; defaultModel: string; advancedModel: string | null }
  | { configured: false; reason: string };

let cached: AiSetup | null = null;

/**
 * Decide qual provedor de IA está ativo, a partir das variáveis de ambiente.
 * Sem credencial, devolve "não configurada" — o app avisa o usuário e
 * NUNCA inventa uma resposta.
 */
export function getAiSetup(): AiSetup {
  if (cached) return cached;
  cached = resolveSetup();
  return cached;
}

/** Só para testes. */
export function resetAiSetupForTests(): void {
  cached = null;
}

function resolveSetup(): AiSetup {
  const wanted = serverEnv.aiProvider?.toLowerCase();
  const advanced = serverEnv.aiModelAdvanced ?? null;

  if (wanted === "simulada" || wanted === "mock") {
    if (!serverEnv.aiAllowMock) {
      return {
        configured: false,
        reason: "A IA simulada só funciona com VIVA_PERMITIR_IA_SIMULADA=1 e fora de produção.",
      };
    }
    return {
      configured: true,
      provider: createMockProvider(),
      simulated: true,
      defaultModel: "simulada",
      advancedModel: null,
    };
  }

  if (wanted === "openai-compat" || (!wanted && !serverEnv.anthropicKey && serverEnv.openaiCompatKey)) {
    const key = serverEnv.openaiCompatKey;
    const baseUrl = serverEnv.openaiCompatBaseUrl;
    const model = serverEnv.aiModelDefault;
    if (!key || !baseUrl || !model) {
      return {
        configured: false,
        reason: "Defina OPENAI_COMPAT_API_KEY, OPENAI_COMPAT_BASE_URL e AI_MODEL_PADRAO.",
      };
    }
    return {
      configured: true,
      provider: createOpenAiCompatProvider(key, baseUrl),
      simulated: false,
      defaultModel: model,
      advancedModel: advanced,
    };
  }

  if (wanted === "anthropic" || !wanted) {
    const key = serverEnv.anthropicKey;
    if (!key) {
      return { configured: false, reason: "Defina ANTHROPIC_API_KEY (ou outro provedor) no servidor." };
    }
    return {
      configured: true,
      provider: createAnthropicProvider(key),
      simulated: false,
      defaultModel: serverEnv.aiModelDefault ?? DEFAULT_ANTHROPIC_MODEL,
      advancedModel: advanced,
    };
  }

  return { configured: false, reason: `Provedor de IA desconhecido: ${wanted}.` };
}

/** Modelo conforme o plano: o avançado só entra se estiver configurado e o plano permitir. */
export function modelForPlan(setup: Extract<AiSetup, { configured: true }>, plan: PlanId): string {
  if (getPlan(plan).limits.advancedModel && setup.advancedModel) return setup.advancedModel;
  return setup.defaultModel;
}

/** Tarefas simples e estruturadas usam sempre o modelo padrão (mais barato). */
export function modelForStructured(setup: Extract<AiSetup, { configured: true }>): string {
  return setup.defaultModel;
}
