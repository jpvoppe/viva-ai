"use server";

import { z } from "zod";
import { fail, ok, requireActionContext, runAction } from "@/lib/actions";
import { todayInTimeZone } from "@/lib/utils";
import type { ActionResult, Recurrence, Task } from "@/lib/types";
import { nextOccurrence } from "./dates";
import { TASK_COLUMNS, taskInputSchema } from "./schema";

// ---------------------------------------------------------------------------
// Tarefas
// ---------------------------------------------------------------------------
export async function createTaskAction(input: unknown): Promise<ActionResult<Task>> {
  return runAction("tarefas.criar", taskInputSchema, input, async (data, { supabase }) => {
    const { data: task, error } = await supabase.from("tasks").insert(data).select(TASK_COLUMNS).single();
    if (error || !task) {
      if (error?.code === "42501") return fail("Este projeto não existe mais.");
      throw new Error(error?.message ?? "tarefa não criada");
    }
    return ok(task as Task, "Tarefa criada.");
  });
}

export async function updateTaskAction(input: unknown): Promise<ActionResult<Task>> {
  return runAction(
    "tarefas.editar",
    taskInputSchema.extend({ id: z.uuid() }),
    input,
    async ({ id, ...data }, { supabase }) => {
      const { data: task, error } = await supabase
        .from("tasks")
        .update(data)
        .eq("id", id)
        .select(TASK_COLUMNS)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!task) return fail("Esta tarefa não existe mais.");
      return ok(task as Task, "Tarefa atualizada.");
    },
  );
}

/**
 * Conclui ou reabre uma tarefa. Ao concluir uma tarefa que se repete,
 * a próxima ocorrência é criada automaticamente.
 */
export async function toggleTaskAction(input: {
  id: string;
  done: boolean;
}): Promise<ActionResult<{ task: Task; next: Task | null }>> {
  return runAction(
    "tarefas.concluir",
    z.object({ id: z.uuid(), done: z.boolean() }),
    input,
    async ({ id, done }, { supabase }) => {
      const { data: current } = await supabase.from("tasks").select(TASK_COLUMNS).eq("id", id).maybeSingle();
      if (!current) return fail("Esta tarefa não existe mais.");
      const wasDone = current.completed_at !== null;
      if (wasDone === done) return ok({ task: current as Task, next: null });

      const { data: task, error } = await supabase
        .from("tasks")
        .update({ completed_at: done ? new Date().toISOString() : null })
        .eq("id", id)
        .select(TASK_COLUMNS)
        .single();
      if (error || !task) throw new Error(error?.message ?? "tarefa não atualizada");

      let next: Task | null = null;
      if (done && task.recurrence !== "nenhuma") {
        const ctx = await requireActionContext();
        const today = todayInTimeZone(ctx?.profile.timezone ?? "America/Sao_Paulo");
        const due = nextOccurrence(task.recurrence as Recurrence, task.due_date, today);
        const { data: created } = await supabase
          .from("tasks")
          .insert({
            title: task.title,
            notes: task.notes,
            priority: task.priority,
            recurrence: task.recurrence,
            project_id: task.project_id,
            due_date: due,
          })
          .select(TASK_COLUMNS)
          .single();
        next = (created as Task | null) ?? null;
      }
      return ok({ task: task as Task, next });
    },
  );
}

export async function deleteTaskAction(input: { id: string }): Promise<ActionResult> {
  return runAction("tarefas.excluir", z.object({ id: z.uuid() }), input, async ({ id }, { supabase }) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return ok(undefined, "Tarefa excluída.");
  });
}

// ---------------------------------------------------------------------------
// Listas
// ---------------------------------------------------------------------------
export type ListItem = { id: string; list_id: string; text: string; done: boolean; position: number };
export type List = { id: string; name: string; kind: "lista" | "compras"; items: ListItem[] };

const listNameSchema = z.string().trim().min(1, "Dê um nome para a lista.").max(120, "Use até 120 caracteres.");
const itemTextSchema = z.string().trim().min(1, "Escreva o item.").max(300, "Use até 300 caracteres.");

export async function createListAction(input: unknown): Promise<ActionResult<List>> {
  return runAction(
    "listas.criar",
    z.object({ name: listNameSchema, kind: z.enum(["lista", "compras"]).default("lista") }),
    input,
    async (data, { supabase }) => {
      const { data: list, error } = await supabase.from("lists").insert(data).select("id, name, kind").single();
      if (error || !list) throw new Error(error?.message ?? "lista não criada");
      return ok({ ...(list as Omit<List, "items">), items: [] }, "Lista criada.");
    },
  );
}

export async function renameListAction(input: unknown): Promise<ActionResult> {
  return runAction(
    "listas.renomear",
    z.object({ id: z.uuid(), name: listNameSchema }),
    input,
    async ({ id, name }, { supabase }) => {
      const { error } = await supabase.from("lists").update({ name }).eq("id", id);
      if (error) throw new Error(error.message);
      return ok(undefined, "Lista renomeada.");
    },
  );
}

export async function deleteListAction(input: { id: string }): Promise<ActionResult> {
  return runAction("listas.excluir", z.object({ id: z.uuid() }), input, async ({ id }, { supabase }) => {
    const { error } = await supabase.from("lists").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return ok(undefined, "Lista excluída.");
  });
}

export async function addListItemAction(input: unknown): Promise<ActionResult<ListItem>> {
  return runAction(
    "listas.item.criar",
    z.object({ list_id: z.uuid(), text: itemTextSchema }),
    input,
    async ({ list_id, text }, { supabase }) => {
      const { count } = await supabase
        .from("list_items")
        .select("id", { count: "exact", head: true })
        .eq("list_id", list_id);
      if ((count ?? 0) >= 300) return fail("Esta lista chegou ao limite de 300 itens.");
      const { data: item, error } = await supabase
        .from("list_items")
        .insert({ list_id, text, position: count ?? 0 })
        .select("id, list_id, text, done, position")
        .single();
      if (error || !item) {
        if (error?.code === "42501") return fail("Esta lista não existe mais.");
        throw new Error(error?.message ?? "item não criado");
      }
      return ok(item as ListItem);
    },
  );
}

export async function toggleListItemAction(input: { id: string; done: boolean }): Promise<ActionResult> {
  return runAction(
    "listas.item.marcar",
    z.object({ id: z.uuid(), done: z.boolean() }),
    input,
    async ({ id, done }, { supabase }) => {
      const { error } = await supabase.from("list_items").update({ done }).eq("id", id);
      if (error) throw new Error(error.message);
      return ok();
    },
  );
}

export async function deleteListItemAction(input: { id: string }): Promise<ActionResult> {
  return runAction("listas.item.excluir", z.object({ id: z.uuid() }), input, async ({ id }, { supabase }) => {
    const { error } = await supabase.from("list_items").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return ok();
  });
}

export async function clearDoneItemsAction(input: { list_id: string }): Promise<ActionResult> {
  return runAction("listas.limpar", z.object({ list_id: z.uuid() }), input, async ({ list_id }, { supabase }) => {
    const { error } = await supabase.from("list_items").delete().eq("list_id", list_id).eq("done", true);
    if (error) throw new Error(error.message);
    return ok(undefined, "Itens marcados removidos.");
  });
}

// ---------------------------------------------------------------------------
// Objetivos
// ---------------------------------------------------------------------------
export type Goal = {
  id: string;
  title: string;
  unit: string;
  target_value: number;
  current_value: number;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
};

const GOAL_COLUMNS = "id, title, unit, target_value, current_value, due_date, completed_at, created_at";

const goalSchema = z.object({
  title: z.string().trim().min(1, "Descreva o objetivo.").max(200, "Use até 200 caracteres."),
  unit: z.string().trim().max(30, "Use até 30 caracteres.").default(""),
  target_value: z.coerce
    .number({ error: "Informe a meta em número." })
    .positive("A meta precisa ser maior que zero.")
    .max(9_999_999, "Meta muito alta."),
  due_date: z
    .union([z.literal(""), z.null(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")])
    .optional()
    .transform((v) => (v ? v : null)),
});

function normalizeGoal(row: Record<string, unknown>): Goal {
  return {
    ...(row as unknown as Goal),
    target_value: Number(row.target_value),
    current_value: Number(row.current_value),
  };
}

export async function createGoalAction(input: unknown): Promise<ActionResult<Goal>> {
  return runAction("objetivos.criar", goalSchema, input, async (data, { supabase }) => {
    const { data: goal, error } = await supabase.from("goals").insert(data).select(GOAL_COLUMNS).single();
    if (error || !goal) throw new Error(error?.message ?? "objetivo não criado");
    return ok(normalizeGoal(goal), "Objetivo criado.");
  });
}

export async function updateGoalProgressAction(input: unknown): Promise<ActionResult<Goal>> {
  return runAction(
    "objetivos.progresso",
    z.object({
      id: z.uuid(),
      current_value: z.coerce.number({ error: "Informe um número." }).min(0, "O valor não pode ser negativo.").max(9_999_999),
    }),
    input,
    async ({ id, current_value }, { supabase }) => {
      const { data: existing } = await supabase.from("goals").select(GOAL_COLUMNS).eq("id", id).maybeSingle();
      if (!existing) return fail("Este objetivo não existe mais.");
      const reached = current_value >= Number(existing.target_value);
      const { data: goal, error } = await supabase
        .from("goals")
        .update({
          current_value,
          completed_at: reached ? (existing.completed_at ?? new Date().toISOString()) : null,
        })
        .eq("id", id)
        .select(GOAL_COLUMNS)
        .single();
      if (error || !goal) throw new Error(error?.message ?? "objetivo não atualizado");
      return ok(normalizeGoal(goal), reached && !existing.completed_at ? "Objetivo alcançado!" : "Progresso atualizado.");
    },
  );
}

export async function deleteGoalAction(input: { id: string }): Promise<ActionResult> {
  return runAction("objetivos.excluir", z.object({ id: z.uuid() }), input, async ({ id }, { supabase }) => {
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return ok(undefined, "Objetivo excluído.");
  });
}

// ---------------------------------------------------------------------------
// Conquistas (confere regras com base em eventos reais)
// ---------------------------------------------------------------------------
export async function syncAchievementsAction(): Promise<ActionResult<string[]>> {
  return runAction("conquistas.conferir", z.object({}), {}, async (_data, { supabase }) => {
    const ctx = await requireActionContext();
    if (!ctx?.preferences.gamification_enabled) return ok([]);
    const { data, error } = await supabase.rpc("sync_achievements");
    if (error) throw new Error(error.message);
    return ok(((data ?? []) as string[]).filter(Boolean));
  });
}
