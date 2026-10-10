"use server";

import { z } from "zod";
import { ok, runAction } from "@/lib/actions";
import type { ActionResult } from "@/lib/types";

export type HistoryItem = { id: string; title: string; last_message_at: string; snippet: string | null };

const PAGE_SIZE = 30;

export async function listConversationsAction(input: unknown): Promise<ActionResult<{ items: HistoryItem[]; hasMore: boolean }>> {
  return runAction(
    "historico.listar",
    z.object({ before: z.iso.datetime({ offset: true }).optional() }),
    input,
    async ({ before }, { supabase }) => {
      let query = supabase
        .from("conversations")
        .select("id, title, last_message_at")
        .order("last_message_at", { ascending: false })
        .limit(PAGE_SIZE + 1);
      if (before) query = query.lt("last_message_at", before);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      return ok({
        items: rows.slice(0, PAGE_SIZE).map((r) => ({ ...r, snippet: null })) as HistoryItem[],
        hasMore: rows.length > PAGE_SIZE,
      });
    },
  );
}

export async function searchConversationsAction(input: unknown): Promise<ActionResult<HistoryItem[]>> {
  return runAction(
    "historico.buscar",
    z.object({ query: z.string().trim().min(2, "Digite pelo menos 2 letras.").max(200) }),
    input,
    async ({ query }, { supabase }) => {
      const { data, error } = await supabase.rpc("search_conversations", { p_query: query, p_limit: 40 });
      if (error) throw new Error(error.message);
      return ok((data ?? []) as HistoryItem[]);
    },
  );
}
