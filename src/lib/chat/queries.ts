import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttachmentInfo, ChatMessageRow } from "@/lib/types";

type MessageRecord = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: ChatMessageRow["status"];
  feedback: -1 | 1 | null;
  created_at: string;
  message_files: { files: AttachmentInfo | null }[] | null;
};

/** Mensagens de uma conversa, com os anexos. O RLS garante que só o dono lê. */
export async function listMessages(supabase: SupabaseClient, conversationId: string): Promise<ChatMessageRow[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, role, content, status, feedback, created_at, message_files(files(id, name, kind, size_bytes, mime_type))",
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as MessageRecord[]).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    status: row.status,
    feedback: row.feedback,
    created_at: row.created_at,
    attachments: (row.message_files ?? []).map((mf) => mf.files).filter((f): f is AttachmentInfo => f !== null),
  }));
}
