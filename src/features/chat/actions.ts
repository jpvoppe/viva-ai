"use server";

import { z } from "zod";
import { fail, ok, runAction } from "@/lib/actions";
import { listMessages } from "@/lib/chat/queries";
import { ATTACHMENTS_BUCKET } from "@/lib/files/storage";
import type { ActionResult, ChatMessageRow } from "@/lib/types";

const idSchema = z.object({ id: z.uuid() });

export async function fetchMessagesAction(input: { id: string }): Promise<ActionResult<ChatMessageRow[]>> {
  return runAction("chat.mensagens", idSchema, input, async ({ id }, { supabase }) => {
    return ok(await listMessages(supabase, id));
  });
}

const renameSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, "Dê um nome para a conversa.").max(160, "Nome muito longo."),
});

export async function renameConversationAction(input: { id: string; title: string }): Promise<ActionResult<{ title: string }>> {
  return runAction("chat.renomear", renameSchema, input, async ({ id, title }, { supabase }) => {
    const { data, error } = await supabase.from("conversations").update({ title }).eq("id", id).select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) return fail("Esta conversa não existe mais.");
    return ok({ title }, "Conversa renomeada.");
  });
}

export async function deleteConversationAction(input: { id: string }): Promise<ActionResult> {
  return runAction("chat.excluir", idSchema, input, async ({ id }, { supabase }) => {
    // Remove também os anexos que só existiam nesta conversa.
    const { data: links } = await supabase
      .from("message_files")
      .select("file_id, files(storage_path), messages!inner(conversation_id)")
      .eq("messages.conversation_id", id);
    const files = ((links ?? []) as unknown as { file_id: string; files: { storage_path: string } | null }[]).filter(
      (l) => l.files,
    );

    const { data, error } = await supabase.from("conversations").delete().eq("id", id).select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) return fail("Esta conversa já tinha sido excluída.");

    if (files.length > 0) {
      await supabase.storage.from(ATTACHMENTS_BUCKET).remove(files.map((f) => f.files!.storage_path));
      await supabase.from("files").delete().in("id", files.map((f) => f.file_id));
    }
    return ok(undefined, "Conversa excluída.");
  });
}

const feedbackSchema = z.object({
  id: z.uuid(),
  value: z.union([z.literal(1), z.literal(-1), z.null()]),
});

export async function setMessageFeedbackAction(input: { id: string; value: 1 | -1 | null }): Promise<ActionResult> {
  return runAction("chat.avaliar", feedbackSchema, input, async ({ id, value }, { supabase }) => {
    const { data, error } = await supabase.from("messages").update({ feedback: value }).eq("id", id).select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) return fail("Esta mensagem não existe mais.");
    return ok();
  });
}
