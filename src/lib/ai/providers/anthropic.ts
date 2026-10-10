import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AiError, type AiProvider, type ChatRequest, type StreamEvent } from "../types";

export function createAnthropicProvider(apiKey: string, baseURL?: string): AiProvider {
  const client = new Anthropic({ apiKey, baseURL, maxRetries: 1, timeout: 120_000 });

  return {
    id: "anthropic",
    supportsImages: true,
    supportsWebSearch: true,

    async *stream(request: ChatRequest, signal: AbortSignal): AsyncIterable<StreamEvent> {
      let inputTokens = 0;
      let outputTokens = 0;
      let stopReason: StreamEvent & { type: "end" } = { type: "end", stopReason: "fim" };

      try {
        const stream = await client.messages.create(
          {
            model: request.model,
            max_tokens: request.maxOutputTokens,
            system: request.system,
            temperature: request.temperature,
            stream: true,
            messages: request.messages.map((turn) => ({
              role: turn.role,
              content: turn.parts.map((part) =>
                part.type === "text"
                  ? { type: "text" as const, text: part.text }
                  : {
                      type: "image" as const,
                      source: {
                        type: "base64" as const,
                        media_type: part.mediaType,
                        data: part.dataBase64,
                      },
                    },
              ),
            })),
            ...(request.webSearch
              ? { tools: [{ type: "web_search_20250305" as const, name: "web_search" as const, max_uses: 3 }] }
              : {}),
          },
          { signal },
        );

        yield { type: "status", activity: "pensando" };

        for await (const event of stream) {
          switch (event.type) {
            case "message_start":
              inputTokens = event.message.usage.input_tokens ?? 0;
              outputTokens = event.message.usage.output_tokens ?? 0;
              break;
            case "content_block_start":
              if (event.content_block.type === "server_tool_use") {
                yield { type: "status", activity: "pesquisando" };
              } else if (event.content_block.type === "text") {
                yield { type: "status", activity: "criando" };
              }
              break;
            case "content_block_delta":
              if (event.delta.type === "text_delta" && event.delta.text) {
                yield { type: "delta", text: event.delta.text };
              }
              break;
            case "message_delta":
              outputTokens = event.usage?.output_tokens ?? outputTokens;
              if (event.usage?.input_tokens) inputTokens = event.usage.input_tokens;
              if (event.delta.stop_reason === "max_tokens") {
                stopReason = { type: "end", stopReason: "limite_tokens" };
              } else if (event.delta.stop_reason === "refusal") {
                throw new AiError("bloqueada", "O modelo recusou este pedido.");
              } else if (event.delta.stop_reason && event.delta.stop_reason !== "end_turn") {
                stopReason = { type: "end", stopReason: "outro" };
              }
              break;
            default:
              break;
          }
        }
      } catch (error) {
        // Mesmo interrompida, a chamada consumiu tokens: informa o que já se sabe.
        if (inputTokens || outputTokens) {
          yield { type: "usage", inputTokens, outputTokens };
        }
        throw mapAnthropicError(error, signal);
      }

      yield { type: "usage", inputTokens, outputTokens };
      // O SDK encerra o fluxo em silêncio quando a chamada é cancelada:
      // sem esta conferência, uma resposta interrompida pareceria completa.
      if (signal.aborted) throw new AiError("interrompida", "Geração interrompida.");
      yield stopReason;
    },
  };
}

function mapAnthropicError(error: unknown, signal: AbortSignal): AiError {
  if (error instanceof AiError) return error;
  if (signal.aborted || error instanceof Anthropic.APIUserAbortError) {
    return new AiError("interrompida", "Geração interrompida.");
  }
  if (error instanceof Anthropic.APIError) {
    const status = error.status ?? 0;
    if (status === 401 || status === 403) {
      return new AiError("credencial_invalida", `Credencial recusada pelo provedor (${status}).`);
    }
    if (status === 429) {
      return new AiError("limite_provedor", "O provedor de IA limitou as requisições.", true);
    }
    if (status === 413) {
      return new AiError("entrada_grande", "O conteúdo enviado é grande demais para o modelo.");
    }
    if (status === 400 && /prompt is too long|too large|maximum/i.test(error.message)) {
      return new AiError("entrada_grande", "O conteúdo enviado é grande demais para o modelo.");
    }
    if (status === 529 || status >= 500) {
      return new AiError("sobrecarga", `O provedor de IA está instável (${status}).`, true);
    }
    return new AiError("falha", `Erro do provedor de IA (${status}).`);
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AiError("sobrecarga", "Não foi possível conectar ao provedor de IA.", true);
  }
  return new AiError("falha", error instanceof Error ? error.message : "Erro desconhecido na IA.");
}
