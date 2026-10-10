import "server-only";
import { AiError, type AiProvider, type ChatRequest, type StreamEvent } from "../types";

/**
 * Provedor genérico para qualquer serviço que fale o formato "chat completions"
 * (OpenAI, Groq, OpenRouter, Mistral, servidores locais etc.).
 * Permite trocar de fornecedor de IA só mudando variáveis de ambiente.
 */
export function createOpenAiCompatProvider(apiKey: string, baseUrl: string): AiProvider {
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  return {
    id: "openai-compat",
    supportsImages: true,
    supportsWebSearch: false,

    async *stream(request: ChatRequest, signal: AbortSignal): AsyncIterable<StreamEvent> {
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          signal,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: request.model,
            max_tokens: request.maxOutputTokens,
            temperature: request.temperature,
            stream: true,
            stream_options: { include_usage: true },
            messages: [
              { role: "system", content: request.system },
              ...request.messages.map((turn) => ({
                role: turn.role,
                content:
                  turn.parts.length === 1 && turn.parts[0].type === "text"
                    ? turn.parts[0].text
                    : turn.parts.map((part) =>
                        part.type === "text"
                          ? { type: "text", text: part.text }
                          : {
                              type: "image_url",
                              image_url: { url: `data:${part.mediaType};base64,${part.dataBase64}` },
                            },
                      ),
              })),
            ],
          }),
        });
      } catch (error) {
        if (signal.aborted) throw new AiError("interrompida", "Geração interrompida.");
        throw new AiError(
          "sobrecarga",
          `Não foi possível conectar ao provedor de IA: ${error instanceof Error ? error.message : "erro de rede"}`,
          true,
        );
      }

      if (!response.ok || !response.body) {
        throw mapStatus(response.status);
      }

      yield { type: "status", activity: "pensando" };

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let started = false;
      let inputTokens = 0;
      let outputTokens = 0;
      let stop: "fim" | "limite_tokens" | "outro" = "fim";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newline: number;
          while ((newline = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") continue;
            let json: OpenAiChunk;
            try {
              json = JSON.parse(payload) as OpenAiChunk;
            } catch {
              continue;
            }
            if (json.usage) {
              inputTokens = json.usage.prompt_tokens ?? inputTokens;
              outputTokens = json.usage.completion_tokens ?? outputTokens;
            }
            const choice = json.choices?.[0];
            const text = choice?.delta?.content;
            if (text) {
              if (!started) {
                started = true;
                yield { type: "status", activity: "criando" };
              }
              yield { type: "delta", text };
            }
            if (choice?.finish_reason === "length") stop = "limite_tokens";
            else if (choice?.finish_reason === "content_filter") {
              throw new AiError("bloqueada", "O modelo recusou este pedido.");
            }
          }
        }
      } catch (error) {
        if (inputTokens || outputTokens) yield { type: "usage", inputTokens, outputTokens };
        if (error instanceof AiError) throw error;
        if (signal.aborted) throw new AiError("interrompida", "Geração interrompida.");
        throw new AiError("falha", error instanceof Error ? error.message : "Erro ao ler a resposta da IA.", true);
      }

      yield { type: "usage", inputTokens, outputTokens };
      if (signal.aborted) throw new AiError("interrompida", "Geração interrompida.");
      yield { type: "end", stopReason: stop };
    },
  };
}

type OpenAiChunk = {
  choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
};

function mapStatus(status: number): AiError {
  if (status === 401 || status === 403) {
    return new AiError("credencial_invalida", `Credencial recusada pelo provedor (${status}).`);
  }
  if (status === 429) return new AiError("limite_provedor", "O provedor de IA limitou as requisições.", true);
  if (status === 413) return new AiError("entrada_grande", "O conteúdo enviado é grande demais para o modelo.");
  if (status >= 500) return new AiError("sobrecarga", `O provedor de IA está instável (${status}).`, true);
  return new AiError("falha", `Erro do provedor de IA (${status}).`);
}
