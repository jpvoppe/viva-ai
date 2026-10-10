import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/env";

export type RateRule = { windowSeconds: number; max: number };

export const RATE_RULES = {
  chat: { windowSeconds: 60, max: 12 },
  generate: { windowSeconds: 60, max: 8 },
  upload: { windowSeconds: 60, max: 10 },
  auth: { windowSeconds: 300, max: 10 },
  mutation: { windowSeconds: 60, max: 90 },
  export: { windowSeconds: 3600, max: 5 },
} satisfies Record<string, RateRule>;

/**
 * Limite de requisições por janela fixa, guardado no banco
 * (funciona em hospedagem sem servidor fixo, sem precisar de Redis).
 * Se o banco falhar, a requisição é recusada: melhor negar do que liberar abuso.
 */
export async function checkRateLimit(key: string, rule: RateRule): Promise<boolean> {
  if (!isServiceRoleConfigured()) {
    // Sem a chave de serviço não há como contar. O app avisa essa pendência em /configuracao-pendente.
    console.warn("[viva:limite] chave de serviço ausente; limite de requisições desativado.");
    return true;
  }
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("rate_limit_hit", {
      p_key: key.slice(0, 200),
      p_window_seconds: rule.windowSeconds,
      p_max: rule.max,
    });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}
