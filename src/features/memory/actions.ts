"use server";

import { z } from "zod";
import { fail, ok, requireActionContext, runAction } from "@/lib/actions";
import { getPlan } from "@/lib/plans";
import type { ActionResult } from "@/lib/types";

export type Memory = { id: string; content: string; created_at: string };

const contentSchema = z
  .string()
  .trim()
  .min(1, "Escreva o que o VIVA deve lembrar.")
  .max(500, "Use até 500 caracteres.");

/**
 * Bloqueia o que parece dado sensível: a memória é para preferências,
 * não para documentos, senhas ou cartões.
 */
function looksSensitive(text: string): boolean {
  const digits = text.replace(/\D/g, "");
  if (/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/.test(text)) return true; // CPF
  if (digits.length >= 13 && /\b(?:\d[ -]?){13,19}\b/.test(text)) return true; // cartão
  if (/\b(senha|password|token|cvv|c[oó]digo de seguran[cç]a)\b\s*[:=]/i.test(text)) return true;
  return false;
}

export async function addMemoryAction(input: { content: string }): Promise<ActionResult<Memory>> {
  return runAction("memoria.criar", z.object({ content: contentSchema }), input, async ({ content }, { supabase }) => {
    const ctx = await requireActionContext();
    if (!ctx) return fail("Sua sessão expirou. Entre de novo para continuar.");
    if (!ctx.preferences.memory_enabled) {
      return fail("A memória está desligada. Ative em Configurações → Memória.");
    }
    if (looksSensitive(content)) {
      return fail("Isso parece um dado sensível (documento, cartão ou senha). O VIVA não guarda esse tipo de informação.");
    }
    const limit = getPlan(ctx.plan).limits.maxMemories;
    const { count } = await supabase.from("memories").select("id", { count: "exact", head: true });
    if ((count ?? 0) >= limit) {
      return fail(`Você chegou ao limite de ${limit} itens de memória do seu plano. Apague algum para adicionar outro.`);
    }
    const { data, error } = await supabase
      .from("memories")
      .insert({ content })
      .select("id, content, created_at")
      .single();
    if (error || !data) throw new Error(error?.message ?? "memória não criada");
    return ok(data as Memory, "Guardado na memória.");
  });
}

export async function updateMemoryAction(input: { id: string; content: string }): Promise<ActionResult<Memory>> {
  return runAction(
    "memoria.editar",
    z.object({ id: z.uuid(), content: contentSchema }),
    input,
    async ({ id, content }, { supabase }) => {
      if (looksSensitive(content)) {
        return fail("Isso parece um dado sensível (documento, cartão ou senha). O VIVA não guarda esse tipo de informação.");
      }
      const { data, error } = await supabase
        .from("memories")
        .update({ content })
        .eq("id", id)
        .select("id, content, created_at")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return fail("Este item não existe mais.");
      return ok(data as Memory, "Memória atualizada.");
    },
  );
}

export async function deleteMemoryAction(input: { id: string }): Promise<ActionResult> {
  return runAction("memoria.excluir", z.object({ id: z.uuid() }), input, async ({ id }, { supabase }) => {
    const { error } = await supabase.from("memories").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return ok(undefined, "Item apagado da memória.");
  });
}

export async function deleteAllMemoriesAction(): Promise<ActionResult> {
  return runAction("memoria.limpar", z.object({}), {}, async (_data, { supabase, user }) => {
    const { error } = await supabase.from("memories").delete().eq("user_id", user.id);
    if (error) throw new Error(error.message);
    return ok(undefined, "Toda a memória foi apagada.");
  });
}

export async function setMemoryEnabledAction(input: { enabled: boolean }): Promise<ActionResult> {
  return runAction(
    "memoria.ativar",
    z.object({ enabled: z.boolean() }),
    input,
    async ({ enabled }, { supabase, user }) => {
      const { error } = await supabase
        .from("user_preferences")
        .update(enabled ? { memory_enabled: true, memory_consent_at: new Date().toISOString() } : { memory_enabled: false })
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);
      return ok(undefined, enabled ? "Memória ativada." : "Memória desativada. Os itens guardados não são mais usados.");
    },
  );
}
