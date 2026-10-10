import type { ApiErrorCode } from "./protocol";
import { AiError } from "./types";

/** Traduz um erro do provedor de IA em código + mensagem clara para o usuário. */
export function describeAiError(error: unknown): { code: ApiErrorCode; message: string; retryable: boolean } {
  if (error instanceof AiError) {
    switch (error.code) {
      case "credencial_invalida":
        return {
          code: "ia_nao_configurada",
          message: "A chave do provedor de IA foi recusada. O administrador precisa conferir a configuração.",
          retryable: false,
        };
      case "limite_provedor":
      case "sobrecarga":
        return {
          code: "ia_indisponivel",
          message: "O serviço de IA está sobrecarregado agora. Tente de novo em instantes.",
          retryable: true,
        };
      case "entrada_grande":
        return {
          code: "mensagem_grande",
          message: "O conteúdo ficou grande demais para a IA processar. Envie um texto ou arquivo menor.",
          retryable: false,
        };
      case "bloqueada":
        return {
          code: "ia_bloqueada",
          message: "A IA não pôde responder a este pedido. Tente reformular.",
          retryable: false,
        };
      default:
        return {
          code: "ia_indisponivel",
          message: "A IA não conseguiu responder agora. Tente de novo.",
          retryable: true,
        };
    }
  }
  return { code: "erro_interno", message: "Algo deu errado do nosso lado. Tente de novo.", retryable: true };
}
