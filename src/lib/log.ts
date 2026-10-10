import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/env";

/**
 * Registro de erros técnicos. Nunca recebe conteúdo de conversa, e-mail ou
 * qualquer dado pessoal: apenas onde falhou, um código e a mensagem técnica.
 */
export async function logError(scope: string, error: unknown, code?: string): Promise<void> {
  const message = sanitize(error instanceof Error ? error.message : String(error));
  console.error(`[viva:${scope}]${code ? ` ${code}` : ""} ${message}`);
  if (!isServiceRoleConfigured()) return;
  try {
    await createAdminClient()
      .from("error_logs")
      .insert({ scope: scope.slice(0, 60), code: code?.slice(0, 80) ?? null, message });
  } catch {
    // Falha ao registrar não pode derrubar a requisição.
  }
}

function sanitize(message: string): string {
  return message
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[e-mail]")
    .replace(/\b(sk|pk|rk|whsec|eyJ)[\w-]{8,}\b/g, "[chave]")
    .replace(/\s+/g, " ")
    .slice(0, 500);
}
