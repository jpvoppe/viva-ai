import "server-only";
import type { ZodType } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getUserContext, type SessionUser } from "@/lib/auth/session";
import { checkRateLimit, RATE_RULES } from "@/lib/limits/rate-limit";
import { logError } from "@/lib/log";
import type { ActionResult, UserContext } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ActionEnv = { user: SessionUser; supabase: Supabase };

export const SESSION_EXPIRED = "Sua sessão expirou. Entre de novo para continuar.";

/**
 * Molde de toda ação do servidor que altera dados:
 * confere a sessão, limita requisições, valida a entrada e trata erros.
 * A autorização fina (de quem é cada linha) fica no banco, via RLS.
 */
export async function runAction<TInput, TOutput>(
  scope: string,
  schema: ZodType<TInput>,
  input: unknown,
  handler: (data: TInput, env: ActionEnv) => Promise<ActionResult<TOutput>>,
): Promise<ActionResult<TOutput>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: SESSION_EXPIRED };

  if (!(await checkRateLimit(`acao:${user.id}`, RATE_RULES.mutation))) {
    return { ok: false, error: "Muitas ações em pouco tempo. Aguarde um instante e tente de novo." };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    const first = parsed.error.issues[0]?.message ?? "Confira os dados informados.";
    return { ok: false, error: first, fieldErrors };
  }

  try {
    const supabase = await createClient();
    return await handler(parsed.data, { user, supabase });
  } catch (error) {
    await logError(scope, error);
    return { ok: false, error: "Não foi possível concluir agora. Tente de novo." };
  }
}

export async function requireActionContext(): Promise<UserContext | null> {
  return getUserContext();
}

export function ok(): ActionResult<undefined>;
export function ok<T>(data: T, message?: string): ActionResult<T>;
export function ok<T>(data?: T, message?: string): ActionResult<T | undefined> {
  return { ok: true, data, message };
}

export function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}
