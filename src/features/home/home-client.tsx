"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUp, Mic, Paperclip } from "lucide-react";
import { STARTER_KEY } from "@/components/chat/chat-view";
import { useApp } from "@/components/shell/app-context";
import { Tooltip } from "@/components/ui/tooltip";
import { useSpeechRecognitionSupported } from "@/hooks/use-speech";
import { DeleteTaskDialog, TaskDialog, TaskRow, sortTasks, useTasks } from "@/features/organizer/task-components";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

export type Shortcut = { id: string; label: string; prompt?: string; href?: string };

function startChat(router: ReturnType<typeof useRouter>, text: string, send: boolean) {
  try {
    sessionStorage.setItem(STARTER_KEY, JSON.stringify({ text, send }));
  } catch {
    // sem armazenamento de sessão: abre o assistente vazio
  }
  router.push("/app/assistente");
}

/** Campo de comando da tela inicial: o que for escrito aqui abre uma conversa. */
export function CommandField({ shortcuts }: { shortcuts: Shortcut[] }) {
  const router = useRouter();
  const { ctx, aiConfigured } = useApp();
  const [text, setText] = useState("");
  const speech = useSpeechRecognitionSupported();
  const attachments = ctx.flags.anexos !== false;
  const canSend = text.trim().length > 0;

  const submit = () => {
    if (!canSend) return;
    startChat(router, text.trim(), aiConfigured);
  };

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className={cn(
          "rounded-xl border border-line-strong bg-surface shadow-2 transition-[border-color,box-shadow] duration-150",
          "focus-within:border-violet focus-within:shadow-[0_0_0_3px_rgb(109_59_245/0.18),var(--elev-2)]",
        )}
      >
        <label htmlFor="comando" className="sr-only">
          Escreva o que você precisa
        </label>
        <textarea
          id="comando"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          rows={2}
          maxLength={4000}
          placeholder="Escreva o que você precisa"
          enterKeyHint="send"
          className="block w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-lg leading-relaxed text-ink placeholder:text-ink-muted focus:outline-none"
        />
        <div className="flex items-center justify-between px-2 pb-2">
          <div className="flex items-center">
            {attachments ? (
              <Tooltip content="Anexar arquivo na conversa">
                <button
                  type="button"
                  onClick={() => startChat(router, text.trim(), false)}
                  aria-label="Abrir o assistente para anexar um arquivo"
                  className="inline-flex size-11 items-center justify-center rounded-md text-ink-muted hover:bg-sunken hover:text-ink"
                >
                  <Paperclip aria-hidden="true" className="size-5" />
                </button>
              </Tooltip>
            ) : null}
            {speech ? (
              <Tooltip content="Ditar por voz na conversa">
                <button
                  type="button"
                  onClick={() => startChat(router, text.trim(), false)}
                  aria-label="Abrir o assistente para ditar por voz"
                  className="inline-flex size-11 items-center justify-center rounded-md text-ink-muted hover:bg-sunken hover:text-ink"
                >
                  <Mic aria-hidden="true" className="size-5" />
                </button>
              </Tooltip>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Enviar mensagem"
            className={cn(
              "inline-flex size-11 items-center justify-center rounded-full transition-[transform,background-color] duration-150 active:scale-90",
              canSend
                ? "bg-violet text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),var(--elev-2)] hover:bg-violet-strong"
                : "bg-sunken text-ink-muted",
            )}
          >
            <ArrowUp aria-hidden="true" className="size-5" strokeWidth={2.5} />
          </button>
        </div>
      </form>

      <ul className="mt-5 grid gap-x-6 sm:grid-cols-2" aria-label="Sugestões para começar">
        {shortcuts.map((shortcut) => (
          <li key={shortcut.id} className="border-b border-line">
            {shortcut.href ? (
              <Link
                href={shortcut.href}
                className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-ink hover:text-violet-text"
              >
                {shortcut.label}
                <span aria-hidden="true" className="text-ink-muted">
                  +
                </span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => startChat(router, shortcut.prompt ?? "", false)}
                className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left text-ink hover:text-violet-text"
              >
                {shortcut.label}
                <span aria-hidden="true" className="text-ink-muted">
                  +
                </span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Tarefas de hoje e atrasadas, com conclusão direto da tela inicial. */
export function TodayTasks({
  tasks: serverTasks,
  today,
  projectNames,
}: {
  tasks: Task[];
  today: string;
  projectNames: Record<string, string>;
}) {
  const state = useTasks(serverTasks);
  const [editing, setEditing] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const visible = state.tasks.slice().sort(sortTasks);

  return (
    <>
      <ul>
        {visible.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            today={today}
            projectName={task.project_id ? projectNames[task.project_id] : null}
            onToggle={state.toggle}
            onEdit={(t) => {
              setEditing(t);
              setDialogOpen(true);
            }}
            onDelete={setDeleting}
          />
        ))}
      </ul>
      <TaskDialog open={dialogOpen} onOpenChange={setDialogOpen} task={editing} onSave={state.save} lockProject />
      <DeleteTaskDialog task={deleting} onClose={() => setDeleting(null)} onConfirm={state.remove} />
    </>
  );
}
