"use server";

import { z } from "zod";
import { fail, ok, runAction } from "@/lib/actions";
import type { ActionResult } from "@/lib/types";

export type DocumentRow = {
  id: string;
  tool: string;
  title: string;
  content: string;
  project_id: string | null;
  updated_at: string;
};

const DOC_COLUMNS = "id, tool, title, content, project_id, updated_at";

const documentSchema = z.object({
  tool: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1, "Dê um título para salvar.").max(160, "Use até 160 caracteres."),
  content: z.string().trim().min(1, "Não há conteúdo para salvar.").max(120_000, "Conteúdo grande demais."),
});

export async function saveDocumentAction(input: unknown): Promise<ActionResult<DocumentRow>> {
  return runAction("criacoes.salvar", documentSchema, input, async (data, { supabase }) => {
    const { data: doc, error } = await supabase.from("documents").insert(data).select(DOC_COLUMNS).single();
    if (error || !doc) throw new Error(error?.message ?? "documento não salvo");
    return ok(doc as DocumentRow, "Salvo nas suas criações.");
  });
}

export async function updateDocumentAction(input: unknown): Promise<ActionResult<DocumentRow>> {
  return runAction(
    "criacoes.editar",
    documentSchema.omit({ tool: true }).extend({ id: z.uuid() }),
    input,
    async ({ id, ...data }, { supabase }) => {
      const { data: doc, error } = await supabase
        .from("documents")
        .update(data)
        .eq("id", id)
        .select(DOC_COLUMNS)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!doc) return fail("Esta criação não existe mais.");
      return ok(doc as DocumentRow, "Alterações salvas.");
    },
  );
}

export async function deleteDocumentAction(input: { id: string }): Promise<ActionResult> {
  return runAction("criacoes.excluir", z.object({ id: z.uuid() }), input, async ({ id }, { supabase }) => {
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return ok(undefined, "Criação excluída.");
  });
}

/** Transforma os itens de uma resposta em uma lista do Organizador. */
export async function createListFromItemsAction(input: unknown): Promise<ActionResult<{ id: string; count: number }>> {
  return runAction(
    "criacoes.lista",
    z.object({
      name: z.string().trim().min(1).max(120),
      kind: z.enum(["lista", "compras"]).default("lista"),
      items: z.array(z.string().trim().min(1).max(300)).min(1, "Nenhum item encontrado na resposta.").max(200),
    }),
    input,
    async ({ name, kind, items }, { supabase }) => {
      const { data: list, error } = await supabase.from("lists").insert({ name, kind }).select("id").single();
      if (error || !list) throw new Error(error?.message ?? "lista não criada");
      const { error: itemsError } = await supabase
        .from("list_items")
        .insert(items.map((text, position) => ({ list_id: list.id, text, position })));
      if (itemsError) {
        await supabase.from("lists").delete().eq("id", list.id);
        throw new Error(itemsError.message);
      }
      return ok({ id: list.id as string, count: items.length }, "Lista criada no Organizador.");
    },
  );
}
