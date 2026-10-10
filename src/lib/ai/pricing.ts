import "server-only";
import { serverEnv } from "@/lib/env";

/** Preço em dólares por 1 milhão de tokens. */
export type ModelPrice = { entrada: number; saida: number };

/**
 * Preços embutidos — confira no site do provedor antes de confiar no painel
 * de custos; preço de IA muda. Para outros modelos, informe AI_PRECOS_JSON:
 *   AI_PRECOS_JSON={"meu-modelo":{"entrada":0.5,"saida":1.5}}
 * Sem preço conhecido, o custo fica "não calculado" (nunca um número inventado).
 */
const BUILT_IN: Record<string, ModelPrice> = {
  "claude-haiku-4-5-20251001": { entrada: 1, saida: 5 },
  simulada: { entrada: 0, saida: 0 },
};

let parsed: Record<string, ModelPrice> | null = null;

function configuredPrices(): Record<string, ModelPrice> {
  if (parsed) return parsed;
  parsed = {};
  const raw = serverEnv.aiPricesJson;
  if (raw) {
    try {
      const json = JSON.parse(raw) as Record<string, Partial<ModelPrice>>;
      for (const [model, price] of Object.entries(json)) {
        if (
          typeof price?.entrada === "number" &&
          typeof price?.saida === "number" &&
          price.entrada >= 0 &&
          price.saida >= 0
        ) {
          parsed[model] = { entrada: price.entrada, saida: price.saida };
        }
      }
    } catch {
      console.error("[viva:ia] AI_PRECOS_JSON inválido; ignorado.");
    }
  }
  return parsed;
}

export function priceFor(model: string): ModelPrice | null {
  return configuredPrices()[model] ?? BUILT_IN[model] ?? null;
}

/** Custo estimado em milionésimos de dólar; null se o preço do modelo é desconhecido. */
export function estimateCostMicroUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  const price = priceFor(model);
  if (!price) return null;
  return Math.round(inputTokens * price.entrada + outputTokens * price.saida);
}
