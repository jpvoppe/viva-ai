"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { ArrowUp, CircleAlert, FileText, Image as ImageIcon, Mic, Paperclip, Square, X } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { useApp } from "@/components/shell/app-context";
import { useDictation, useSpeechRecognitionSupported, type DictationError } from "@/hooks/use-speech";
import { uploadFile } from "@/lib/files/upload-client";
import { ACCEPT_ATTRIBUTE, ACCEPTED_LABEL } from "@/lib/files/validate";
import { getPlan } from "@/lib/plans";
import { cn, formatBytes } from "@/lib/utils";
import type { AttachmentInfo } from "@/lib/types";

const MAX_ATTACHMENTS = 4;

type PendingAttachment = {
  localId: string;
  name: string;
  size: number;
  isImage: boolean;
  progress: number;
  status: "enviando" | "pronto" | "erro";
  info?: AttachmentInfo;
  error?: string;
  controller: AbortController;
};

export type ComposerHandle = {
  focus: () => void;
  setText: (text: string) => void;
};

const DICTATION_ERRORS: Record<DictationError, string> = {
  permissao: "O navegador bloqueou o microfone. Libere o acesso nas permissões do site para ditar.",
  sem_microfone: "Nenhum microfone foi encontrado neste aparelho.",
  rede: "O ditado precisa de internet e não conseguiu conectar.",
  outro: "Não foi possível usar o ditado agora.",
};

export function Composer({
  ref,
  running,
  disabled,
  disabledReason,
  placeholder = "Escreva a sua mensagem",
  onSend,
  onStop,
  onDirtyChange,
}: {
  ref?: Ref<ComposerHandle>;
  running: boolean;
  disabled?: boolean;
  disabledReason?: string;
  placeholder?: string;
  onSend: (content: string, attachments: AttachmentInfo[]) => void;
  onStop: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { ctx, setUsage } = useApp();
  const toast = useToast();
  const plan = getPlan(ctx.plan);
  const maxChars = plan.limits.maxInputChars;
  const attachmentsEnabled = ctx.flags.anexos !== false;

  const [text, setTextState] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setText = useCallback(
    (value: string) => {
      setTextState(value);
    },
    [],
  );

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    setText: (value: string) => {
      setTextState(value);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(value.length, value.length);
        }
      });
    },
  }));

  // Altura automática do campo, até um limite.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [text]);

  const dirty = text.trim().length > 0 || attachments.length > 0;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // --- Voz -------------------------------------------------------------------
  const speechSupported = useSpeechRecognitionSupported();
  const dictation = useDictation({
    onFinalText: (spoken) => {
      setTextState((current) => {
        const joiner = current && !/\s$/.test(current) ? " " : "";
        return (current + joiner + spoken.trim()).slice(0, maxChars);
      });
    },
    onError: (error) => toast.error(DICTATION_ERRORS[error]),
  });

  // --- Anexos ----------------------------------------------------------------
  const addFiles = useCallback(
    (files: File[]) => {
      if (!attachmentsEnabled) {
        toast.error("O envio de arquivos está desativado no momento.");
        return;
      }
      const room = MAX_ATTACHMENTS - attachments.length;
      if (room <= 0) {
        toast.error(`Você pode anexar até ${MAX_ATTACHMENTS} arquivos por mensagem.`);
        return;
      }
      if (files.length > room) {
        toast.info(`Só ${room === 1 ? "1 arquivo coube" : `${room} arquivos couberam`}: o limite é ${MAX_ATTACHMENTS} por mensagem.`);
      }
      for (const file of files.slice(0, room)) {
        const localId = crypto.randomUUID();
        const controller = new AbortController();
        const base: PendingAttachment = {
          localId,
          name: file.name,
          size: file.size,
          isImage: file.type.startsWith("image/"),
          progress: 0,
          status: "enviando",
          controller,
        };
        if (file.size > plan.limits.maxFileBytes) {
          setAttachments((list) => [
            ...list,
            { ...base, status: "erro", error: `Passa do limite de ${formatBytes(plan.limits.maxFileBytes)} do seu plano.` },
          ]);
          continue;
        }
        setAttachments((list) => [...list, base]);
        void uploadFile(
          file,
          (fraction) =>
            setAttachments((list) => list.map((a) => (a.localId === localId ? { ...a, progress: fraction } : a))),
          controller.signal,
        ).then((result) => {
          if (result.ok) {
            setUsage("arquivo", result.usage.used, result.usage.limit);
            if (result.truncated) {
              toast.info(`“${file.name}” é longo: o VIVA vai considerar só o começo do texto.`);
            }
            setAttachments((list) =>
              list.map((a) => (a.localId === localId ? { ...a, status: "pronto", progress: 1, info: result.file } : a)),
            );
          } else if (result.aborted) {
            setAttachments((list) => list.filter((a) => a.localId !== localId));
          } else {
            setAttachments((list) =>
              list.map((a) => (a.localId === localId ? { ...a, status: "erro", error: result.message } : a)),
            );
          }
        });
      }
    },
    [attachments.length, attachmentsEnabled, plan.limits.maxFileBytes, setUsage, toast],
  );

  const removeAttachment = useCallback((attachment: PendingAttachment) => {
    if (attachment.status === "enviando") {
      attachment.controller.abort();
      return;
    }
    setAttachments((list) => list.filter((a) => a.localId !== attachment.localId));
    if (attachment.info) {
      void fetch(`/api/files/${attachment.info.id}`, { method: "DELETE" }).catch(() => {});
    }
  }, []);

  // --- Envio -----------------------------------------------------------------
  const uploading = attachments.some((a) => a.status === "enviando");
  const hasFailed = attachments.some((a) => a.status === "erro");
  const tooLong = text.length > maxChars;
  const canSend = !running && !disabled && !uploading && !hasFailed && !tooLong && text.trim().length > 0;

  const submit = useCallback(() => {
    if (!canSend) return;
    if (dictation.listening) dictation.stop();
    const ready = attachments.filter((a) => a.info).map((a) => a.info as AttachmentInfo);
    onSend(text.trim(), ready);
    setTextState("");
    setAttachments([]);
  }, [attachments, canSend, dictation, onSend, text]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape" && running) {
      event.preventDefault();
      onStop();
      return;
    }
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    const wantsSend = ctx.preferences.enter_to_send
      ? !event.shiftKey
      : event.ctrlKey || event.metaKey;
    if (wantsSend) {
      event.preventDefault();
      submit();
    }
  };

  const hint = disabled
    ? disabledReason
    : tooLong
      ? `A mensagem passou do limite de ${maxChars.toLocaleString("pt-BR")} caracteres do seu plano.`
      : hasFailed
        ? "Remova o arquivo com erro para enviar."
        : null;

  return (
    <div className="w-full">
      {dictation.listening ? (
        <div className="mb-2 flex items-center gap-3 rounded-md bg-tint px-3 py-2 text-sm text-ink" role="status">
          <span aria-hidden="true" className="flex h-6 items-center gap-[3px]">
            {(dictation.levels.length ? dictation.levels : Array.from({ length: 12 }, () => 0.15)).map((value, i) => (
              <span
                key={i}
                className="wave-bar block h-6 w-[3px] rounded-full bg-violet"
                style={{ "--level": Math.max(0.15, value) } as React.CSSProperties}
              />
            ))}
          </span>
          <span className="min-w-0 flex-1 truncate">
            {dictation.interim ? dictation.interim : "Ouvindo… fale a sua mensagem."}
          </span>
          <button type="button" onClick={dictation.stop} className="shrink-0 rounded-sm px-2 py-1 font-medium text-violet-text hover:bg-tint-strong">
            Parar ditado
          </button>
        </div>
      ) : null}

      <div
        className={cn(
          "rounded-xl border bg-surface shadow-2 transition-[border-color,box-shadow] duration-150",
          "focus-within:border-violet focus-within:shadow-[0_0_0_3px_rgb(109_59_245/0.18),var(--elev-2)]",
          dragging ? "border-violet border-dashed" : "border-line-strong",
          disabled && "opacity-70",
        )}
        onDragOver={(event) => {
          if (!attachmentsEnabled) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const files = Array.from(event.dataTransfer.files);
          if (files.length) addFiles(files);
        }}
      >
        {attachments.length > 0 ? (
          <ul className="flex flex-wrap gap-2 px-3 pt-3" aria-label="Arquivos anexados">
            {attachments.map((attachment) => {
              const Icon = attachment.status === "erro" ? CircleAlert : attachment.isImage ? ImageIcon : FileText;
              return (
                <li
                  key={attachment.localId}
                  className={cn(
                    "relative flex max-w-full items-center gap-2 overflow-hidden rounded-md border py-1.5 pl-2.5 pr-1 text-sm",
                    attachment.status === "erro" ? "border-danger/50 bg-danger-bg" : "border-line bg-sunken",
                  )}
                >
                  <Icon
                    aria-hidden="true"
                    className={cn("size-4 shrink-0", attachment.status === "erro" ? "text-danger" : "text-ink-muted")}
                  />
                  <span className="min-w-0">
                    <span className="block max-w-48 truncate text-ink">{attachment.name}</span>
                    <span className={cn("block", attachment.status === "erro" ? "text-danger" : "text-ink-muted")}>
                      {attachment.status === "enviando"
                        ? `Enviando… ${Math.round(attachment.progress * 100)}%`
                        : attachment.status === "erro"
                          ? attachment.error
                          : formatBytes(attachment.size)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(attachment)}
                    aria-label={
                      attachment.status === "enviando"
                        ? `Cancelar envio de ${attachment.name}`
                        : `Remover ${attachment.name}`
                    }
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-ink-muted hover:bg-surface hover:text-ink"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                  {attachment.status === "enviando" ? (
                    <span
                      role="progressbar"
                      aria-label={`Envio de ${attachment.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(attachment.progress * 100)}
                      className="absolute inset-x-0 bottom-0 h-[3px] bg-line"
                    >
                      <span
                        className="block h-full bg-violet transition-[width] duration-150"
                        style={{ width: `${attachment.progress * 100}%` }}
                      />
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}

        <label htmlFor="mensagem" className="sr-only">
          Mensagem para o VIVA
        </label>
        <textarea
          id="mensagem"
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.files);
            if (files.length) {
              event.preventDefault();
              addFiles(files);
            }
          }}
          rows={1}
          disabled={disabled}
          placeholder={placeholder}
          aria-describedby={hint ? "mensagem-aviso" : undefined}
          aria-invalid={tooLong || undefined}
          enterKeyHint={ctx.preferences.enter_to_send ? "send" : "enter"}
          className="block max-h-[220px] w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-base leading-relaxed text-ink placeholder:text-ink-muted focus:outline-none disabled:cursor-not-allowed"
        />

        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <div className="flex items-center">
            {attachmentsEnabled ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPT_ATTRIBUTE}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    if (files.length) addFiles(files);
                    event.target.value = "";
                  }}
                />
                <Tooltip content={`Anexar arquivo (${ACCEPTED_LABEL})`}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled}
                    aria-label="Anexar arquivo"
                    className="inline-flex size-11 items-center justify-center rounded-md text-ink-muted hover:bg-sunken hover:text-ink disabled:opacity-50"
                  >
                    <Paperclip aria-hidden="true" className="size-5" />
                  </button>
                </Tooltip>
              </>
            ) : null}
            {speechSupported ? (
              <Tooltip content={dictation.listening ? "Parar ditado" : "Ditar por voz (o áudio é transcrito pelo seu navegador)"}>
                <button
                  type="button"
                  onClick={dictation.listening ? dictation.stop : dictation.start}
                  disabled={disabled}
                  aria-label={dictation.listening ? "Parar ditado" : "Ditar mensagem por voz"}
                  aria-pressed={dictation.listening}
                  className={cn(
                    "inline-flex size-11 items-center justify-center rounded-md hover:bg-sunken disabled:opacity-50",
                    dictation.listening ? "bg-tint text-violet-text" : "text-ink-muted hover:text-ink",
                  )}
                >
                  <Mic aria-hidden="true" className="size-5" />
                </button>
              </Tooltip>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            {text.length > maxChars * 0.8 ? (
              <span className={cn("text-sm tabular-nums", tooLong ? "font-medium text-danger" : "text-ink-muted")}>
                {text.length.toLocaleString("pt-BR")} / {maxChars.toLocaleString("pt-BR")}
              </span>
            ) : null}
            {running ? (
              <button
                type="button"
                onClick={onStop}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 font-medium text-bg transition-transform active:scale-95"
              >
                <Square aria-hidden="true" className="size-4 fill-current" />
                Parar
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!canSend}
                aria-label="Enviar mensagem"
                className={cn(
                  "inline-flex size-11 items-center justify-center rounded-full transition-[transform,background-color,box-shadow] duration-150 active:scale-90",
                  canSend
                    ? "bg-violet text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),var(--elev-2)] hover:bg-violet-strong"
                    : "bg-sunken text-ink-muted",
                )}
              >
                <ArrowUp aria-hidden="true" className="size-5" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>

      {hint ? (
        <p id="mensagem-aviso" role="status" className={cn("mt-2 text-sm", tooLong || hasFailed ? "text-danger" : "text-ink-muted")}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
