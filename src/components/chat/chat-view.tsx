"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, EllipsisVertical, FolderKanban, Pencil, Trash2 } from "lucide-react";
import { Orb } from "@/components/orb/orb";
import { useApp } from "@/components/shell/app-context";
import { useAchievements } from "@/components/shell/achievements";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, fieldAria, Input, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import {
  deleteConversationAction,
  fetchMessagesAction,
  renameConversationAction,
  setMessageFeedbackAction,
} from "@/features/chat/actions";
import { addMemoryAction } from "@/features/memory/actions";
import { useChatStream, type StreamError } from "@/hooks/use-chat-stream";
import { useSpeaker, useSpeechSynthesisSupported } from "@/hooks/use-speech";
import type { OrbState } from "@/components/orb/orb";
import type { AttachmentInfo, ChatMessageRow } from "@/lib/types";
import { Composer, type ComposerHandle } from "./composer";
import { AssistantMessage, StreamingMessage, UserMessage } from "./message-item";

export const STARTER_KEY = "viva-primeira-mensagem";

const SUGGESTIONS = [
  { id: "explicar", label: "Explique algo que não entendi", prompt: "Quero entender melhor um assunto. O assunto é: " },
  { id: "semana", label: "Organize minha semana", prompt: "Me ajude a organizar a minha semana. Estes são os meus compromissos e tarefas: " },
  { id: "conteudo", label: "Crie um conteúdo para mim", prompt: "Preciso de ajuda para criar um conteúdo. É sobre: " },
  { id: "estudos", label: "Monte um plano de estudos", prompt: "Monte um plano de estudos para mim. Quero aprender: " },
  { id: "viagem", label: "Ajude-me a planejar uma viagem", prompt: "Me ajude a planejar uma viagem. Destino, datas e orçamento: " },
  { id: "projeto", label: "Transforme uma ideia em um projeto", prompt: "Tenho uma ideia e quero transformá-la em um projeto com etapas. A ideia é: " },
];

export function ChatView({
  conversationId: initialConversationId,
  initialTitle,
  initialMessages,
  project,
  onConversationStarted,
}: {
  conversationId: string | null;
  initialTitle: string;
  initialMessages: ChatMessageRow[];
  project?: { id: string; name: string } | null;
  /** Avisa a tela de "nova conversa" que o endereço passou a ser o da conversa criada. */
  onConversationStarted?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const { ctx, aiConfigured, setUsage, usage, touchRecent, removeRecent } = useApp();
  const stream = useChatStream();
  const achievements = useAchievements();
  const speaker = useSpeaker();
  const canSpeak = useSpeechSynthesisSupported();

  const [conversationId, setConversationId] = useState(initialConversationId);
  const [title, setTitle] = useState(initialTitle);
  const [messages, setMessages] = useState(initialMessages);
  const [error, setError] = useState<StreamError | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [memoryDraft, setMemoryDraft] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);

  const composerRef = useRef<ComposerHandle>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const conversationRef = useRef(conversationId);
  useEffect(() => {
    conversationRef.current = conversationId;
  }, [conversationId]);

  const limitReached = usage.mensagem.used >= usage.mensagem.limit;

  // --- Rolagem inteligente ---------------------------------------------------
  useEffect(() => {
    const node = endRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setAtBottom(entry.isIntersecting), {
      rootMargin: "0px 0px 160px 0px",
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const scrollToEnd = useCallback((smooth: boolean) => {
    endRef.current?.scrollIntoView({ block: "end", behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Acompanha a resposta enquanto ela chega, só se a pessoa estiver no fim da conversa.
  useLayoutEffect(() => {
    if (stream.running && atBottom) scrollToEnd(false);
  }, [stream.text, stream.running, atBottom, scrollToEnd]);

  useEffect(() => {
    if (initialMessages.length > 0) scrollToEnd(false);
  }, [initialMessages.length, scrollToEnd]);

  // --- Aviso antes de perder o que não foi enviado -------------------------------
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current || stream.running) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [stream.running]);

  const syncFromServer = useCallback(async (id: string) => {
    const result = await fetchMessagesAction({ id });
    if (result.ok) setMessages(result.data);
  }, []);

  const run = useCallback(
    (body: Record<string, unknown>) => {
      setError(null);
      speaker.stop();
      void stream.start({
        url: "/api/chat",
        body,
        onMeta: (meta) => {
          if (!conversationRef.current) {
            conversationRef.current = meta.conversationId;
            setConversationId(meta.conversationId);
            setTitle(meta.title);
            window.history.replaceState(null, "", `/app/assistente/${meta.conversationId}`);
            onConversationStarted?.();
          }
          touchRecent({ id: meta.conversationId, title: meta.title || title });
          if (meta.userMessageId) {
            setMessages((list) =>
              list.map((m) => (m.id === "local-user" ? { ...m, id: meta.userMessageId as string } : m)),
            );
          }
        },
        onDone: (done, text) => {
          if (done.usage) setUsage("mensagem", done.usage.used, done.usage.limit);
          if (text.trim()) {
            setMessages((list) => [
              ...list,
              {
                id: done.messageId ?? `local-${Date.now()}`,
                role: "assistant",
                content: text,
                status: done.status,
                feedback: null,
                created_at: new Date().toISOString(),
                attachments: [],
              },
            ]);
          }
          stream.reset();
          achievements.check();
          if (done.truncated) {
            toast.info("A resposta chegou ao tamanho máximo do seu plano. Peça “continue” para seguir.");
          }
          if (ctx.preferences.voice_reply && canSpeak && text.trim()) {
            speaker.speak(done.messageId ?? "ultima", text);
          }
        },
        onError: (streamError, partial) => {
          if (streamError.usage) setUsage("mensagem", streamError.usage.used, streamError.usage.limit);
          setError(streamError);
          stream.reset();
          // O que já tinha chegado pode ter sido salvo: confere com o servidor.
          if (partial.trim() && conversationRef.current) void syncFromServer(conversationRef.current);
        },
        onAbort: (partial) => {
          stream.reset();
          if (partial.trim()) {
            setMessages((list) => [
              ...list,
              {
                id: `local-${Date.now()}`,
                role: "assistant",
                content: partial,
                status: "interrompida",
                feedback: null,
                created_at: new Date().toISOString(),
                attachments: [],
              },
            ]);
          }
          // O servidor grava o trecho parcial; busca os ids definitivos em seguida.
          const id = conversationRef.current;
          if (id) setTimeout(() => void syncFromServer(id), 1200);
        },
      });
    },
    [achievements, canSpeak, ctx.preferences.voice_reply, onConversationStarted, setUsage, speaker, stream, syncFromServer, title, toast, touchRecent],
  );

  const send = useCallback(
    (content: string, attachments: AttachmentInfo[]) => {
      setMessages((list) => [
        ...list,
        {
          id: "local-user",
          role: "user",
          content,
          status: "completa",
          feedback: null,
          created_at: new Date().toISOString(),
          attachments,
        },
      ]);
      requestAnimationFrame(() => scrollToEnd(true));
      run({
        conversationId: conversationRef.current,
        projectId: project?.id ?? null,
        content,
        fileIds: attachments.map((a) => a.id),
      });
    },
    [project?.id, run, scrollToEnd],
  );

  const regenerate = useCallback(() => {
    if (!conversationRef.current || stream.running) return;
    setMessages((list) => (list.at(-1)?.role === "assistant" ? list.slice(0, -1) : list));
    run({ conversationId: conversationRef.current, regenerate: true });
  }, [run, stream.running]);

  // Mensagem iniciada na página Início.
  const starterHandled = useRef(false);
  useEffect(() => {
    if (starterHandled.current || initialConversationId) return;
    starterHandled.current = true;
    let starter: string | null = null;
    try {
      starter = sessionStorage.getItem(STARTER_KEY);
      sessionStorage.removeItem(STARTER_KEY);
    } catch {
      starter = null;
    }
    if (!starter) return;
    try {
      const parsed = JSON.parse(starter) as { text?: string; send?: boolean };
      if (!parsed.text) return;
      const text = parsed.text;
      // Fora do corpo do efeito, para não encadear renderizações.
      setTimeout(() => {
        if (parsed.send && aiConfigured) send(text, []);
        else composerRef.current?.setText(text);
      }, 0);
    } catch {
      // conteúdo inesperado: ignora
    }
  }, [aiConfigured, initialConversationId, send]);

  const onFeedback = useCallback(
    (id: string, value: 1 | -1 | null) => {
      void setMessageFeedbackAction({ id, value }).then((result) => {
        if (!result.ok) toast.error(result.error);
        else if (value !== null) toast.success("Obrigado pela avaliação.");
      });
    },
    [toast],
  );

  const onRename = async (formData: FormData) => {
    if (!conversationId) return;
    setBusy(true);
    setRenameError(null);
    const result = await renameConversationAction({ id: conversationId, title: String(formData.get("title") ?? "") });
    setBusy(false);
    if (!result.ok) {
      setRenameError(result.error);
      return;
    }
    setTitle(result.data.title);
    touchRecent({ id: conversationId, title: result.data.title });
    setRenameOpen(false);
    toast.success("Conversa renomeada.");
  };

  const onDelete = async () => {
    if (!conversationId) return;
    setBusy(true);
    const result = await deleteConversationAction({ id: conversationId });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    removeRecent(conversationId);
    setDeleteOpen(false);
    toast.success("Conversa excluída.");
    router.push("/app/assistente");
  };

  const saveMemory = async (formData: FormData) => {
    setBusy(true);
    const result = await addMemoryAction({ content: String(formData.get("content") ?? "") });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setMemoryDraft(null);
    toast.success("Guardado na memória.");
  };

  const empty = messages.length === 0 && !stream.running;
  const phase: OrbState = stream.phase === "parado" ? "pensando" : (stream.phase as OrbState);
  const lastMessage = messages.at(-1);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3.5rem-var(--bottom-nav-h))] w-full max-w-[var(--content-w)] flex-col px-4 sm:px-6 lg:min-h-dvh">
      {conversationId ? (
        <header className="sticky top-14 z-20 -mx-4 flex items-center justify-between gap-3 border-b border-line bg-bg/90 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-0">
          <div className="min-w-0">
            <h1 className="truncate font-sans text-base font-semibold tracking-normal">{title}</h1>
            {project ? (
              <Link
                href={`/app/projetos/${project.id}`}
                className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
              >
                <FolderKanban aria-hidden="true" className="size-3.5" />
                Projeto: {project.name}
              </Link>
            ) : null}
          </div>
          <Menu>
            <MenuTrigger asChild>
              <button
                type="button"
                aria-label="Opções da conversa"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-sunken hover:text-ink"
              >
                <EllipsisVertical aria-hidden="true" className="size-5" />
              </button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem icon={<Pencil />} onSelect={() => setRenameOpen(true)}>
                Renomear conversa
              </MenuItem>
              <MenuItem icon={<Trash2 />} danger onSelect={() => setDeleteOpen(true)}>
                Excluir conversa
              </MenuItem>
            </MenuContent>
          </Menu>
        </header>
      ) : null}

      {empty ? (
        <div className="flex flex-1 flex-col justify-center py-10">
          <Orb size={56} />
          <h1 className="mt-6 text-3xl sm:text-4xl" style={{ fontStretch: "88%" }}>
            {project ? `Vamos avançar em “${project.name}”?` : "O que vamos resolver hoje?"}
          </h1>
          <p className="mt-2 max-w-prose text-ink-soft">
            {project
              ? "Esta conversa conhece o objetivo e as etapas em aberto do projeto."
              : "Escreva com as suas palavras. Você também pode anexar um arquivo ou ditar por voz."}
          </p>
          {!project ? (
            <ul className="mt-8 grid gap-x-6 sm:grid-cols-2" aria-label="Sugestões para começar">
              {SUGGESTIONS.map((suggestion) => (
                <li key={suggestion.id} className="border-b border-line">
                  <button
                    type="button"
                    onClick={() => composerRef.current?.setText(suggestion.prompt)}
                    className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left text-ink hover:text-violet-text"
                  >
                    {suggestion.label}
                    <span aria-hidden="true" className="text-ink-muted">
                      +
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <ol className="flex flex-1 flex-col gap-6 py-6" aria-label="Mensagens da conversa">
          {messages.map((message, index) =>
            message.role === "user" ? (
              <UserMessage
                key={message.id}
                message={message}
                canRemember={ctx.preferences.memory_enabled}
                onRemember={setMemoryDraft}
              />
            ) : (
              <AssistantMessage
                key={message.id}
                message={message}
                isLast={index === messages.length - 1 && !stream.running}
                canSpeak={canSpeak}
                speaking={speaker.speakingId === message.id}
                onSpeak={speaker.speak}
                onStopSpeaking={speaker.stop}
                onRegenerate={regenerate}
                onFeedback={onFeedback}
              />
            ),
          )}
          {stream.running ? <StreamingMessage phase={phase} text={stream.text} /> : null}
        </ol>
      )}

      <div ref={endRef} aria-hidden="true" />

      <div className="sticky bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px))] z-10 -mx-4 bg-gradient-to-t from-bg from-70% to-transparent px-4 pb-3 pt-6 sm:-mx-6 sm:px-6 lg:bottom-0 lg:pb-5">
        {!atBottom && !empty ? (
          <div className="pointer-events-none absolute inset-x-0 -top-6 flex justify-center">
            <button
              type="button"
              onClick={() => scrollToEnd(true)}
              className="pointer-events-auto inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-raised px-4 text-sm font-medium text-ink shadow-2 animate-fade-in"
            >
              <ArrowDown aria-hidden="true" className="size-4" />
              Ir para o fim
            </button>
          </div>
        ) : null}

        {error ? (
          <Alert
            tone={error.code === "limite_plano" ? "atencao" : "erro"}
            title={error.message}
            className="mb-3"
            action={
              <>
                {error.retryable && lastMessage?.role === "user" && conversationId ? (
                  <Button size="sm" variant="secondary" onClick={regenerate}>
                    Tentar de novo
                  </Button>
                ) : null}
                {error.code === "limite_plano" && ctx.plan === "gratuito" ? (
                  <Link
                    href="/app/configuracoes?aba=assinatura"
                    className="inline-flex min-h-9 items-center font-medium text-violet-text underline underline-offset-4"
                  >
                    Conhecer o VIVA Plus
                  </Link>
                ) : null}
                {error.code === "sessao_expirada" ? (
                  <Link href="/entrar" className="inline-flex min-h-9 items-center font-medium text-violet-text underline underline-offset-4">
                    Entrar de novo
                  </Link>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => setError(null)}>
                  Fechar aviso
                </Button>
              </>
            }
          />
        ) : null}

        {!aiConfigured ? (
          <Alert tone="atencao" title="A IA ainda não foi configurada neste ambiente." className="mb-3">
            O administrador precisa informar a chave de um provedor de IA. Enquanto isso, o VIVA não responde —
            e não inventa respostas.
          </Alert>
        ) : null}

        <Composer
          ref={composerRef}
          running={stream.running}
          disabled={!aiConfigured || ctx.flags.assistente === false}
          disabledReason={
            ctx.flags.assistente === false
              ? "O assistente está temporariamente desativado."
              : "Envio indisponível até a IA ser configurada."
          }
          placeholder={limitReached ? "Limite de mensagens de hoje atingido" : "Escreva a sua mensagem"}
          onSend={send}
          onStop={stream.stop}
          onDirtyChange={(dirty) => {
            dirtyRef.current = dirty;
          }}
        />
        <p className="mt-2 text-center text-sm text-ink-muted">
          O VIVA pode errar. Confira informações importantes.
        </p>
      </div>

      <Dialog
        open={renameOpen}
        onOpenChange={(open) => {
          setRenameOpen(open);
          if (!open) setRenameError(null);
        }}
        title="Renomear conversa"
        size="sm"
      >
        <form action={onRename} className="flex flex-col gap-4">
          <Field id="titulo-conversa" label="Nome da conversa" error={renameError}>
            <Input {...fieldAria("titulo-conversa", renameError)} name="title" defaultValue={title} maxLength={160} required autoFocus />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setRenameOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy}>
              Salvar nome
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir esta conversa?"
        description="As mensagens e os arquivos enviados nela serão apagados. Não dá para desfazer."
        confirmLabel="Excluir conversa"
        danger
        loading={busy}
        onConfirm={onDelete}
      />

      <Dialog
        open={memoryDraft !== null}
        onOpenChange={(open) => {
          if (!open) setMemoryDraft(null);
        }}
        title="Guardar na memória"
        description="O VIVA usa o que está na memória para personalizar as próximas respostas. Você pode ver e apagar tudo em Configurações."
      >
        <form action={saveMemory} className="flex flex-col gap-4">
          <Field id="memoria-conteudo" label="O que o VIVA deve lembrar" hint="Edite para ficar curto e claro. Não guarde senhas nem documentos.">
            <Textarea
              {...fieldAria("memoria-conteudo", null, true)}
              name="content"
              defaultValue={(memoryDraft ?? "").slice(0, 500)}
              maxLength={500}
              rows={4}
              required
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setMemoryDraft(null)}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy}>
              Guardar na memória
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
