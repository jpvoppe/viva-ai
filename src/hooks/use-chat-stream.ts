"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiErrorBody, ApiErrorCode, ServerEvent, UsageInfo } from "@/lib/ai/protocol";
import type { AiActivity } from "@/lib/ai/types";

export type StreamPhase = "parado" | AiActivity | "concluido" | "erro";

export type StreamError = { code: ApiErrorCode | "sem_conexao"; message: string; retryable: boolean; usage?: UsageInfo };

export type StreamRequest = {
  url: string;
  body: unknown;
  onMeta?: (event: Extract<ServerEvent, { type: "meta" }>) => void;
  onDone?: (event: Extract<ServerEvent, { type: "done" }>, text: string) => void;
  onError?: (error: StreamError, partialText: string) => void;
  onAbort?: (partialText: string) => void;
};

/**
 * Lê uma resposta transmitida aos poucos (NDJSON) e expõe:
 * o texto parcial, a fase REAL informada pelo servidor e o controle de parada.
 * O texto é repassado à tela no ritmo dos quadros (sem atraso artificial).
 */
export function useChatStream() {
  const [phase, setPhase] = useState<StreamPhase>("parado");
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const bufferRef = useRef("");
  const frameRef = useRef<number | null>(null);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    frameRef.current = null;
    setText(bufferRef.current);
  }, []);

  const scheduleFlush = useCallback(() => {
    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(flush);
    }
  }, [flush]);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    };
  }, []);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    bufferRef.current = "";
    setText("");
    setPhase("parado");
  }, []);

  const start = useCallback(
    async (request: StreamRequest) => {
      if (controllerRef.current) return;
      const controller = new AbortController();
      controllerRef.current = controller;
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
      bufferRef.current = "";
      setText("");
      setRunning(true);
      setPhase("pensando");

      const finish = (next: StreamPhase) => {
        controllerRef.current = null;
        setRunning(false);
        setPhase(next);
        if (next === "concluido") {
          doneTimerRef.current = setTimeout(() => setPhase("parado"), 900);
        }
      };

      const fail = (error: StreamError) => {
        finish("erro");
        request.onError?.(error, bufferRef.current);
      };

      let response: Response;
      try {
        response = await fetch(request.url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request.body),
          signal: controller.signal,
        });
      } catch {
        if (controller.signal.aborted) {
          finish("parado");
          request.onAbort?.("");
          return;
        }
        fail({
          code: "sem_conexao",
          message: "Sem conexão com o VIVA. Confira a sua internet e tente de novo.",
          retryable: true,
        });
        return;
      }

      if (!response.ok || !response.body) {
        let parsed: ApiErrorBody | null = null;
        try {
          parsed = (await response.json()) as ApiErrorBody;
        } catch {
          parsed = null;
        }
        fail({
          code: parsed?.error.code ?? "erro_interno",
          message: parsed?.error.message ?? "Algo deu errado do nosso lado. Tente de novo.",
          retryable: parsed?.error.retryable ?? response.status >= 500,
          usage: parsed?.error.usage,
        });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      let settled = false;

      const handle = (event: ServerEvent) => {
        switch (event.type) {
          case "meta":
            request.onMeta?.(event);
            break;
          case "status":
            setPhase(event.activity);
            break;
          case "delta":
            bufferRef.current += event.text;
            scheduleFlush();
            break;
          case "done":
            settled = true;
            flushNow();
            finish("concluido");
            request.onDone?.(event, bufferRef.current);
            break;
          case "error":
            settled = true;
            flushNow();
            fail({ code: event.code, message: event.message, retryable: event.retryable });
            break;
        }
      };

      const flushNow = () => {
        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
        setText(bufferRef.current);
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });
          let newline: number;
          while ((newline = pending.indexOf("\n")) >= 0) {
            const line = pending.slice(0, newline).trim();
            pending = pending.slice(newline + 1);
            if (!line) continue;
            try {
              handle(JSON.parse(line) as ServerEvent);
            } catch {
              // linha incompleta ou inválida: ignora
            }
          }
        }
        if (!settled) {
          flushNow();
          fail({
            code: "sem_conexao",
            message: "A conexão caiu antes de a resposta terminar. Tente de novo.",
            retryable: true,
          });
        }
      } catch {
        flushNow();
        if (controller.signal.aborted) {
          finish("parado");
          request.onAbort?.(bufferRef.current);
        } else if (!settled) {
          fail({
            code: "sem_conexao",
            message: "A conexão caiu antes de a resposta terminar. Tente de novo.",
            retryable: true,
          });
        }
      }
    },
    [scheduleFlush],
  );

  return { phase, text, running, start, stop, reset };
}
