"use client";

import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import type { ChatMessageRow } from "@/lib/types";
import { ChatView } from "./chat-view";

const NEW_CHAT_PATH = "/app/assistente";

/**
 * Tela de "nova conversa".
 *
 * Quando a primeira mensagem é enviada, o endereço muda para o da conversa
 * criada sem recarregar a tela (para a resposta não ser interrompida).
 * O Next.js mantém esta tela em memória; por isso, sempre que a pessoa volta
 * ao endereço de nova conversa depois de ter começado uma, a tela é zerada.
 */
export function NewChat({ project }: { project: { id: string; name: string } | null }) {
  const pathname = usePathname();
  const [epoch, setEpoch] = useState(0);
  const [started, setStarted] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (pathname === NEW_CHAT_PATH && started) {
      setStarted(false);
      setEpoch((value) => value + 1);
    }
  }

  const onStarted = useCallback(() => setStarted(true), []);
  const empty: ChatMessageRow[] = [];

  return (
    <ChatView
      key={`${project?.id ?? "nova"}-${epoch}`}
      conversationId={null}
      initialTitle=""
      initialMessages={empty}
      project={project}
      onConversationStarted={onStarted}
    />
  );
}
