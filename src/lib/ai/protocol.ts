/**
 * Formato das mensagens que o servidor envia ao navegador durante uma geração.
 * Uma linha JSON por evento (NDJSON).
 */
import type { AiActivity } from "./types";

export type UsageInfo = { used: number; limit: number };

export type ServerEvent =
  | { type: "meta"; conversationId: string; userMessageId: string | null; title: string; simulated: boolean }
  | { type: "status"; activity: AiActivity }
  | { type: "delta"; text: string }
  | {
      type: "done";
      messageId: string | null;
      status: "completa" | "interrompida";
      truncated: boolean;
      usage: UsageInfo | null;
    }
  | { type: "error"; code: ApiErrorCode; message: string; retryable: boolean };

export type ApiErrorCode =
  | "nao_autenticado"
  | "sessao_expirada"
  | "requisicao_invalida"
  | "recurso_desativado"
  | "ia_nao_configurada"
  | "limite_plano"
  | "muitas_requisicoes"
  | "orcamento_esgotado"
  | "mensagem_grande"
  | "nao_encontrado"
  | "ia_indisponivel"
  | "ia_bloqueada"
  | "arquivo_invalido"
  | "armazenamento_indisponivel"
  | "erro_interno";

export type ApiErrorBody = {
  error: { code: ApiErrorCode; message: string; retryable?: boolean; usage?: UsageInfo };
};

export function encodeEvent(event: ServerEvent): string {
  return `${JSON.stringify(event)}\n`;
}
