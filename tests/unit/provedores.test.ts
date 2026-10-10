// @vitest-environment node
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAnthropicProvider } from "@/lib/ai/providers/anthropic";
import { createOpenAiCompatProvider } from "@/lib/ai/providers/openai-compat";
import { AiError, type ChatRequest, type StreamEvent } from "@/lib/ai/types";

/**
 * Os provedores são testados contra um servidor HTTP local que responde
 * no formato real de cada API (eventos SSE). Nenhuma chamada sai para a internet.
 */
const request: ChatRequest = {
  model: "modelo-teste",
  system: "sistema",
  messages: [{ role: "user", parts: [{ type: "text", text: "olá" }] }],
  maxOutputTokens: 100,
};

async function collect(iterable: AsyncIterable<StreamEvent>): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

let server: http.Server;
let baseUrl = "";
let handler: (req: http.IncomingMessage, res: http.ServerResponse, body: string) => void = () => {};

beforeEach(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => handler(req, res, body));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  vi.restoreAllMocks();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

const sse = (res: http.ServerResponse, events: [string | null, unknown][]) => {
  res.writeHead(200, { "content-type": "text/event-stream" });
  for (const [name, data] of events) {
    if (name) res.write(`event: ${name}\n`);
    res.write(`data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`);
  }
  res.end();
};

describe("provedor Anthropic", () => {
  it("transforma os eventos da API em texto, fases reais e consumo", async () => {
    let received: Record<string, unknown> = {};
    let apiKey: string | undefined;
    handler = (req, res, body) => {
      received = JSON.parse(body);
      apiKey = req.headers["x-api-key"] as string;
      sse(res, [
        ["message_start", { type: "message_start", message: { id: "m1", type: "message", role: "assistant", model: "x", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 12, output_tokens: 1 } } }],
        ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }],
        ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Olá, " } }],
        ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "mundo" } }],
        ["content_block_stop", { type: "content_block_stop", index: 0 }],
        ["message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 7 } }],
        ["message_stop", { type: "message_stop" }],
      ]);
    };
    const provider = createAnthropicProvider("chave-de-teste", baseUrl);
    const events = await collect(provider.stream(request, new AbortController().signal));

    expect(apiKey).toBe("chave-de-teste");
    expect(received).toMatchObject({ model: "modelo-teste", max_tokens: 100, system: "sistema", stream: true });
    expect(received.tools).toBeUndefined();
    expect(events.filter((e) => e.type === "delta").map((e) => (e.type === "delta" ? e.text : "")).join("")).toBe("Olá, mundo");
    expect(events.filter((e) => e.type === "status")).toEqual([
      { type: "status", activity: "pensando" },
      { type: "status", activity: "criando" },
    ]);
    expect(events).toContainEqual({ type: "usage", inputTokens: 12, outputTokens: 7 });
    expect(events.at(-1)).toEqual({ type: "end", stopReason: "fim" });
  });

  it("sinaliza quando a resposta foi cortada pelo limite de tokens", async () => {
    handler = (_req, res) =>
      sse(res, [
        ["message_start", { type: "message_start", message: { id: "m", type: "message", role: "assistant", model: "x", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } }],
        ["message_delta", { type: "message_delta", delta: { stop_reason: "max_tokens", stop_sequence: null }, usage: { output_tokens: 100 } }],
        ["message_stop", { type: "message_stop" }],
      ]);
    const events = await collect(createAnthropicProvider("k", baseUrl).stream(request, new AbortController().signal));
    expect(events.at(-1)).toEqual({ type: "end", stopReason: "limite_tokens" });
  });

  it("envia imagens e a ferramenta de pesquisa quando pedida", async () => {
    let received: { messages?: { content: unknown[] }[]; tools?: unknown[] } = {};
    handler = (_req, res, body) => {
      received = JSON.parse(body);
      sse(res, [["message_stop", { type: "message_stop" }]]);
    };
    await collect(
      createAnthropicProvider("k", baseUrl).stream(
        {
          ...request,
          webSearch: true,
          messages: [{ role: "user", parts: [{ type: "image", mediaType: "image/png", dataBase64: "AAAA" }, { type: "text", text: "?" }] }],
        },
        new AbortController().signal,
      ),
    );
    expect(received.messages?.[0].content[0]).toEqual({ type: "image", source: { type: "base64", media_type: "image/png", data: "AAAA" } });
    expect(received.tools).toEqual([{ type: "web_search_20250305", name: "web_search", max_uses: 3 }]);
  });

  it.each([
    [401, "credencial_invalida", false],
    [429, "limite_provedor", true],
    [529, "sobrecarga", true],
    [413, "entrada_grande", false],
  ])("traduz o erro HTTP %i", async (status, code, retryable) => {
    handler = (_req, res) => {
      res.writeHead(status as number, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type: "x", message: "detalhe interno" } }));
    };
    const provider = createAnthropicProvider("k", baseUrl);
    const error = await collect(provider.stream(request, new AbortController().signal)).catch((e) => e);
    expect(error).toBeInstanceOf(AiError);
    expect(error.code).toBe(code);
    expect(error.retryable).toBe(retryable);
  });

  it("interrompe quando o usuário cancela", async () => {
    handler = (_req, res) => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write(`event: message_start\ndata: ${JSON.stringify({ type: "message_start", message: { id: "m", type: "message", role: "assistant", model: "x", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 5, output_tokens: 0 } } })}\n\n`);
      // nunca termina
    };
    const controller = new AbortController();
    const provider = createAnthropicProvider("k", baseUrl);
    const events: StreamEvent[] = [];
    const run = (async () => {
      for await (const event of provider.stream(request, controller.signal)) events.push(event);
    })();
    setTimeout(() => controller.abort(), 150);
    const error = await run.catch((e) => e);
    expect(error).toBeInstanceOf(AiError);
    expect(error.code).toBe("interrompida");
    // Mesmo interrompida, o consumo conhecido é informado (para registrar custo).
    expect(events).toContainEqual({ type: "usage", inputTokens: 5, outputTokens: 0 });
  });
});

describe("provedor compatível com OpenAI", () => {
  it("lê o fluxo de respostas e o consumo", async () => {
    let received: Record<string, unknown> = {};
    let auth: string | undefined;
    handler = (req, res, body) => {
      received = JSON.parse(body);
      auth = req.headers.authorization;
      sse(res, [
        [null, { choices: [{ delta: { role: "assistant", content: "" } }] }],
        [null, { choices: [{ delta: { content: "Olá" } }] }],
        [null, { choices: [{ delta: { content: " mundo" }, finish_reason: "stop" }] }],
        [null, { choices: [], usage: { prompt_tokens: 9, completion_tokens: 3 } }],
        [null, "[DONE]"],
      ]);
    };
    const provider = createOpenAiCompatProvider("segredo", `${baseUrl}/v1/`);
    const events = await collect(provider.stream(request, new AbortController().signal));
    expect(auth).toBe("Bearer segredo");
    expect(received).toMatchObject({ model: "modelo-teste", max_tokens: 100, stream: true });
    expect((received.messages as { role: string }[])[0]).toEqual({ role: "system", content: "sistema" });
    expect(events.filter((e) => e.type === "delta").map((e) => (e.type === "delta" ? e.text : "")).join("")).toBe("Olá mundo");
    expect(events).toContainEqual({ type: "usage", inputTokens: 9, outputTokens: 3 });
    expect(events.at(-1)).toEqual({ type: "end", stopReason: "fim" });
  });

  it("traduz erros HTTP e falha de conexão", async () => {
    handler = (_req, res) => {
      res.writeHead(500);
      res.end("erro");
    };
    const failing = await collect(createOpenAiCompatProvider("k", baseUrl).stream(request, new AbortController().signal)).catch((e) => e);
    expect(failing).toMatchObject({ code: "sobrecarga", retryable: true });

    const offline = await collect(createOpenAiCompatProvider("k", "http://127.0.0.1:9").stream(request, new AbortController().signal)).catch((e) => e);
    expect(offline).toBeInstanceOf(AiError);
    expect(offline.retryable).toBe(true);
  });
});
