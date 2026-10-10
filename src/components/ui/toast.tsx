"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "sucesso" | "erro" | "info";
type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; onClick: () => void };
};

type ToastApi = {
  success: (message: string, action?: Toast["action"]) => void;
  error: (message: string, action?: Toast["action"]) => void;
  info: (message: string, action?: Toast["action"]) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa estar dentro de ToastProvider");
  return ctx;
}

const ICONS = { sucesso: CircleCheck, erro: CircleAlert, info: Info } as const;

/** Avisos curtos no canto da tela, anunciados para leitores de tela. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string, action?: Toast["action"]) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { id, kind, message, action }]);
      const ms = kind === "erro" || action ? 8000 : 4500;
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), ms),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const timer of map.values()) clearTimeout(timer);
      map.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m, a) => push("sucesso", m, a),
      error: (m, a) => push("erro", m, a),
      info: (m, a) => push("info", m, a),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px)+0.75rem)] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:px-6"
        role="region"
        aria-label="Avisos"
      >
        {toasts.map((toast) => {
          const Icon = ICONS[toast.kind];
          return (
            <div
              key={toast.id}
              role={toast.kind === "erro" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-md border bg-raised p-3 pl-4 text-ink shadow-3 animate-rise",
                toast.kind === "erro" ? "border-danger/50" : "border-line",
              )}
            >
              <Icon
                aria-hidden="true"
                className={cn(
                  "mt-0.5 size-5 shrink-0",
                  toast.kind === "sucesso" && "text-success",
                  toast.kind === "erro" && "text-danger",
                  toast.kind === "info" && "text-info",
                )}
              />
              <p className="min-w-0 flex-1 text-base">{toast.message}</p>
              {toast.action ? (
                <button
                  type="button"
                  className="shrink-0 rounded-sm px-2 py-1 font-medium text-violet-text hover:bg-sunken"
                  onClick={() => {
                    toast.action?.onClick();
                    dismiss(toast.id);
                  }}
                >
                  {toast.action.label}
                </button>
              ) : null}
              <button
                type="button"
                aria-label="Fechar aviso"
                className="-m-1 inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-ink-muted hover:bg-sunken hover:text-ink"
                onClick={() => dismiss(toast.id)}
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
