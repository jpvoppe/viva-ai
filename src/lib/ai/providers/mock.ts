import "server-only";
import { AiError, type AiProvider, type ChatRequest, type StreamEvent } from "../types";

/**
 * IA SIMULADA — existe só para testes automatizados e desenvolvimento sem chave.
 * Nunca é usada em produção e a interface avisa quando está ativa.
 * As respostas são fixas e sempre se identificam como simuladas.
 */
export function createMockProvider(): AiProvider {
  return {
    id: "simulada",
    supportsImages: true,
    supportsWebSearch: false,

    async *stream(request: ChatRequest, signal: AbortSignal): AsyncIterable<StreamEvent> {
      const last = request.messages.at(-1);
      const userText =
        last?.parts
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join(" ") ?? "";

      if (userText.includes("[[erro-simulado]]")) {
        throw new AiError("sobrecarga", "Falha simulada do provedor.", true);
      }

      yield { type: "status", activity: "pensando" };
      await wait(60, signal);
      yield { type: "status", activity: "criando" };

      const text = mockText(request.purpose ?? "chat", userText);
      const slow = userText.includes("[[lento]]");
      const pieces = text.match(/[\s\S]{1,24}/g) ?? [];
      for (const piece of pieces) {
        await wait(slow ? 120 : 4, signal);
        yield { type: "delta", text: piece };
      }
      yield {
        type: "usage",
        inputTokens: Math.ceil(userText.length / 4) + 50,
        outputTokens: Math.ceil(text.length / 4),
      };
      yield { type: "end", stopReason: "fim" };
    },
  };
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new AiError("interrompida", "Geração interrompida."));
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new AiError("interrompida", "Geração interrompida."));
      },
      { once: true },
    );
  });
}

function mockText(purpose: string, userText: string): string {
  switch (purpose) {
    case "cartoes":
      return JSON.stringify([
        { frente: "Cartão simulado 1: o que é fotossíntese?", verso: "Resposta simulada 1." },
        { frente: "Cartão simulado 2: onde ela acontece?", verso: "Resposta simulada 2." },
        { frente: "Cartão simulado 3: o que ela produz?", verso: "Resposta simulada 3." },
      ]);
    case "quiz":
      return JSON.stringify([
        {
          pergunta: "Pergunta simulada 1?",
          opcoes: ["Opção A", "Opção B", "Opção C", "Opção D"],
          correta: 1,
          explicacao: "Explicação simulada: a opção B é a correta neste teste.",
        },
        {
          pergunta: "Pergunta simulada 2?",
          opcoes: ["Opção A", "Opção B", "Opção C", "Opção D"],
          correta: 0,
          explicacao: "Explicação simulada: a opção A é a correta neste teste.",
        },
      ]);
    case "etapas":
      return JSON.stringify([
        { titulo: "Etapa simulada 1: definir o resultado esperado" },
        { titulo: "Etapa simulada 2: listar o que é necessário" },
        { titulo: "Etapa simulada 3: executar a primeira ação" },
      ]);
    default:
      return (
        "**Resposta simulada** (modo de teste, sem IA real).\n\n" +
        `Recebi a sua mensagem: "${userText.replace(/\[\[[^\]]+\]\]/g, "").trim().slice(0, 200)}".\n\n` +
        "- Este texto é fixo e serve para testar a interface.\n" +
        "- Configure um provedor de IA para obter respostas de verdade.\n\n" +
        "```ts\nconst exemplo = 'bloco de código';\n```\n"
      );
  }
}
