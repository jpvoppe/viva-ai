"use client";

import { Dialog as RadixDialog } from "radix-ui";
import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * Janela modal acessível: prende o foco, fecha com Esc e devolve o foco ao botão que abriu.
 * No celular, sobe da base da tela (mais fácil de alcançar com o polegar).
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  // Quem abriu a janela (botão ou item de menu) recebe o foco de volta ao fechar.
  // O Radix só faz isso sozinho quando existe um "Trigger"; aqui as janelas abrem por estado,
  // então guardamos o elemento em foco no instante em que "open" vira verdadeiro.
  const [wasOpen, setWasOpen] = useState(open);
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && typeof document !== "undefined") {
      const active = document.activeElement;
      setOpener(active instanceof HTMLElement && active !== document.body ? active : null);
    }
  }
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <RadixDialog.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener && opener.isConnected) opener.focus();
          }}
          className={cn(
            "fixed z-50 flex max-h-[min(92dvh,760px)] w-full flex-col bg-raised text-ink shadow-3 outline-none",
            "inset-x-0 bottom-0 rounded-t-xl pb-safe data-[state=open]:animate-rise",
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:pb-0 sm:data-[state=open]:animate-fade-in",
            size === "sm" && "sm:max-w-sm",
            size === "md" && "sm:max-w-lg",
            size === "lg" && "sm:max-w-2xl",
          )}
        >
          <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
            <div className="min-w-0">
              <RadixDialog.Title className="font-display text-xl font-semibold">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-1 text-ink-soft">{description}</RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar"
                className="-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-sunken hover:text-ink"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </RadixDialog.Close>
          </div>
          {children ? (
            <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
          ) : null}
          {footer ? (
            <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              {footer}
            </div>
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** Confirmação antes de ações que apagam ou não podem ser desfeitas. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  danger = false,
  loading = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
