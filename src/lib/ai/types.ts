/**
 * Contrato interno entre o VIVA e qualquer provedor de IA.
 * Para trocar de provedor, basta implementar esta interface em
 * src/lib/ai/providers e registrá-la em src/lib/ai/index.ts.
 */

export type AiActivity = "pensando" | "pesquisando" | "criando";

export type ChatPart =
  | { type: "text"; text: string }
  | { type: "image"; mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif"; dataBase64: string };

export type ChatTurn = { role: "user" | "assistant"; parts: ChatPart[] };

export type ChatRequest = {
  model: string;
  system: string;
  messages: ChatTurn[];
  maxOutputTokens: number;
  temperature?: number;
  /** Pede ao provedor para pesquisar na web, se ele souber fazer isso. */
  webSearch?: boolean;
  /** Rótulo do recurso que originou a chamada (registro de consumo e IA simulada). */
  purpose?: string;
};

export type StreamEvent =
  | { type: "status"; activity: AiActivity }
  | { type: "delta"; text: string }
  | { type: "usage"; inputTokens: number; outputTokens: number }
  | { type: "end"; stopReason: "fim" | "limite_tokens" | "outro" };

export interface AiProvider {
  readonly id: string;
  readonly supportsImages: boolean;
  readonly supportsWebSearch: boolean;
  stream(request: ChatRequest, signal: AbortSignal): AsyncIterable<StreamEvent>;
}

export type AiErrorCode =
  | "nao_configurada"
  | "credencial_invalida"
  | "sobrecarga"
  | "limite_provedor"
  | "entrada_grande"
  | "bloqueada"
  | "interrompida"
  | "falha";

export class AiError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    message: string,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "AiError";
  }
}
