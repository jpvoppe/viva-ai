"use client";

import dynamic from "next/dynamic";
import { memo, useState } from "react";
import {
  BookmarkPlus,
  Check,
  Copy,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  Square,
  ThumbsDown,
  ThumbsUp,
  Volume2,
} from "lucide-react";
import { Orb, orbLabel, type OrbState } from "@/components/orb/orb";
import { Tooltip } from "@/components/ui/tooltip";
import { cn, formatBytes } from "@/lib/utils";
import type { AttachmentInfo, ChatMessageRow } from "@/lib/types";
import { useCopy } from "./markdown";

const Markdown = dynamic(() => import("./markdown"), {
  loading: () => <div className="h-6 w-40 animate-skeleton rounded-md bg-sunken" aria-hidden="true" />,
});

function ActionButton({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={pressed}
        className={cn(
          "inline-flex size-10 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-sunken hover:text-ink [&>svg]:size-[18px]",
          pressed && "bg-tint text-violet-text",
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

export function AttachmentChip({ file, href }: { file: AttachmentInfo; href?: string }) {
  const Icon = file.kind === "imagem" ? ImageIcon : FileText;
  const body = (
    <>
      <Icon aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
      <span className="truncate">{file.name}</span>
      <span className="shrink-0 text-ink-muted">{formatBytes(file.size_bytes)}</span>
    </>
  );
  const className =
    "inline-flex max-w-full items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink";
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn(className, "hover:border-line-strong")}>
      {body}
    </a>
  ) : (
    <span className={className}>{body}</span>
  );
}

export const UserMessage = memo(function UserMessage({
  message,
  canRemember,
  onRemember,
}: {
  message: ChatMessageRow;
  canRemember: boolean;
  onRemember: (text: string) => void;
}) {
  return (
    <li className="group flex flex-col items-end gap-1.5" data-role="user">
      <span className="sr-only">Você disse:</span>
      {message.attachments.length > 0 ? (
        <div className="flex max-w-[92%] flex-wrap justify-end gap-1.5">
          {message.attachments.map((file) => (
            <AttachmentChip key={file.id} file={file} href={`/api/files/${file.id}`} />
          ))}
        </div>
      ) : null}
      <div className="max-w-[92%] whitespace-pre-wrap rounded-lg rounded-br-sm bg-tint px-4 py-2.5 text-ink sm:max-w-[80%]">
        {message.content}
      </div>
      {canRemember ? (
        <button
          type="button"
          onClick={() => onRemember(message.content)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-sm text-ink-muted hover:bg-sunken hover:text-ink sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100"
        >
          <BookmarkPlus aria-hidden="true" className="size-4" />
          Guardar na memória
        </button>
      ) : null}
    </li>
  );
});

export const AssistantMessage = memo(function AssistantMessage({
  message,
  isLast,
  canSpeak,
  speaking,
  onSpeak,
  onStopSpeaking,
  onRegenerate,
  onFeedback,
}: {
  message: ChatMessageRow;
  isLast: boolean;
  canSpeak: boolean;
  speaking: boolean;
  onSpeak: (id: string, text: string) => void;
  onStopSpeaking: () => void;
  onRegenerate: () => void;
  onFeedback: (id: string, value: 1 | -1 | null) => void;
}) {
  const [copied, copy] = useCopy();
  const [feedback, setFeedback] = useState(message.feedback);
  const persisted = !message.id.startsWith("local-");

  const vote = (value: 1 | -1) => {
    const next = feedback === value ? null : value;
    setFeedback(next);
    onFeedback(message.id, next);
  };

  return (
    <li className="flex gap-3" data-role="assistant">
      <div className="pt-1">
        <Orb size={26} />
      </div>
      <div className="min-w-0 flex-1">
        <span className="sr-only">VIVA respondeu:</span>
        <Markdown content={message.content} />
        {message.status === "interrompida" ? (
          <p className="mt-2 text-sm text-ink-muted">Resposta interrompida.</p>
        ) : null}
        <div className="-ml-2 mt-1 flex flex-wrap items-center">
          <ActionButton label={copied ? "Copiado" : "Copiar resposta"} onClick={() => void copy(message.content)}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          </ActionButton>
          {canSpeak ? (
            speaking ? (
              <ActionButton label="Parar leitura" onClick={onStopSpeaking} pressed>
                <Square aria-hidden="true" />
              </ActionButton>
            ) : (
              <ActionButton label="Ouvir resposta" onClick={() => onSpeak(message.id, message.content)}>
                <Volume2 aria-hidden="true" />
              </ActionButton>
            )
          ) : null}
          {isLast ? (
            <ActionButton label="Gerar outra resposta" onClick={onRegenerate}>
              <RefreshCw aria-hidden="true" />
            </ActionButton>
          ) : null}
          {persisted ? (
            <>
              <ActionButton label="Resposta útil" onClick={() => vote(1)} pressed={feedback === 1}>
                <ThumbsUp aria-hidden="true" />
              </ActionButton>
              <ActionButton label="Resposta não ajudou" onClick={() => vote(-1)} pressed={feedback === -1}>
                <ThumbsDown aria-hidden="true" />
              </ActionButton>
            </>
          ) : null}
          <span className="sr-only" aria-live="polite">
            {copied ? "Resposta copiada" : ""}
          </span>
        </div>
      </div>
    </li>
  );
});

/** Resposta em andamento: mostra a fase real e o texto conforme chega. */
export function StreamingMessage({ phase, text }: { phase: OrbState; text: string }) {
  return (
    <li className="flex gap-3" data-role="assistant" data-streaming="true">
      <div className="pt-1">
        <Orb size={26} state={phase} />
      </div>
      <div className="min-w-0 flex-1">
        {text ? (
          <Markdown content={text} />
        ) : (
          <p className="flex min-h-8 items-center text-ink-muted">{orbLabel(phase)}…</p>
        )}
        <span className="sr-only" role="status" aria-live="polite">
          {orbLabel(phase)}
        </span>
      </div>
    </li>
  );
}
