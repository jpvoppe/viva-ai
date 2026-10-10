import "server-only";
import type { ApiErrorBody, ApiErrorCode, UsageInfo } from "@/lib/ai/protocol";

const DEFAULT_STATUS: Record<ApiErrorCode, number> = {
  nao_autenticado: 401,
  sessao_expirada: 401,
  requisicao_invalida: 400,
  recurso_desativado: 403,
  ia_nao_configurada: 503,
  limite_plano: 429,
  muitas_requisicoes: 429,
  orcamento_esgotado: 503,
  mensagem_grande: 413,
  nao_encontrado: 404,
  ia_indisponivel: 502,
  ia_bloqueada: 422,
  arquivo_invalido: 422,
  armazenamento_indisponivel: 503,
  erro_interno: 500,
};

/** Resposta de erro padronizada das rotas /api: código estável + mensagem para o usuário. */
export function apiError(
  code: ApiErrorCode,
  message: string,
  extra?: { retryable?: boolean; usage?: UsageInfo; status?: number },
): Response {
  const body: ApiErrorBody = {
    error: { code, message, retryable: extra?.retryable, usage: extra?.usage },
  };
  return Response.json(body, {
    status: extra?.status ?? DEFAULT_STATUS[code],
    headers: { "cache-control": "no-store" },
  });
}

/**
 * Recusa requisições de outro site (proteção contra CSRF nas rotas /api,
 * que usam o cookie de sessão).
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    const site = request.headers.get("sec-fetch-site");
    return site === null || site === "same-origin" || site === "none";
  }
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
