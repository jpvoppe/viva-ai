import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { ChatView } from "@/components/chat/chat-view";
import { requireContext } from "@/lib/auth/session";
import { listMessages } from "@/lib/chat/queries";
import { createClient } from "@/lib/supabase/server";
import Loading from "../../loading";

export const metadata: Metadata = { title: "Conversa" };

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Loading />}>
      <Conversation params={params} />
    </Suspense>
  );
}

async function Conversation({ params }: { params: Promise<{ id: string }> }) {
  await requireContext();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const supabase = await createClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, title, project_id, projects(id, name)")
    .eq("id", id.data)
    .maybeSingle();
  if (!conversation) notFound();

  const messages = await listMessages(supabase, conversation.id);
  const project = conversation.projects as unknown as { id: string; name: string } | null;

  return (
    <ChatView
      key={conversation.id}
      conversationId={conversation.id}
      initialTitle={conversation.title}
      initialMessages={messages}
      project={project}
    />
  );
}
