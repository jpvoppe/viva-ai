"use server";

import { z } from "zod";
import { fail, ok, requireActionContext, runAction } from "@/lib/actions";
import { getPlan } from "@/lib/plans";
import { TASK_COLUMNS } from "@/features/organizer/schema";
import type { ActionResult, Project, Task } from "@/lib/types";

const PROJECT_COLUMNS = "id, name, goal, status, completed_at, created_at, updated_at";

const projectSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome para o projeto.").max(120, "Use até 120 caracteres."),
  goal: z.string().trim().max(2000, "Use até 2.000 caracteres.").default(""),
});

export async function createProjectAction(input: unknown): Promise<ActionResult<Project>> {
  return runAction("projetos.criar", projectSchema, input, async (data, { supabase }) => {
    const ctx = await requireActionContext();
    if (!ctx) return fail("Sua sessão expirou. Entre de novo para continuar.");
    const plan = getPlan(ctx.plan);
    const { count } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("status", "ativo");
    if ((count ?? 0) >= plan.limits.maxActiveProjects) {
      return fail(
        `O plano ${plan.name} permite ${plan.limits.maxActiveProjects} projetos ativos. Conclua ou arquive um projeto para criar outro.`,
      );
    }
    const { data: project, error } = await supabase.from("projects").insert(data).select(PROJECT_COLUMNS).single();
    if (error || !project) throw new Error(error?.message ?? "projeto não criado");
    return ok(project as Project, "Projeto criado.");
  });
}

export async function updateProjectAction(input: unknown): Promise<ActionResult<Project>> {
  return runAction(
    "projetos.editar",
    projectSchema.extend({ id: z.uuid() }),
    input,
    async ({ id, ...data }, { supabase }) => {
      const { data: project, error } = await supabase
        .from("projects")
        .update(data)
        .eq("id", id)
        .select(PROJECT_COLUMNS)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!project) return fail("Este projeto não existe mais.");
      return ok(project as Project, "Projeto atualizado.");
    },
  );
}

export async function setProjectStatusAction(input: unknown): Promise<ActionResult<Project>> {
  return runAction(
    "projetos.status",
    z.object({ id: z.uuid(), status: z.enum(["ativo", "concluido", "arquivado"]) }),
    input,
    async ({ id, status }, { supabase }) => {
      if (status === "ativo") {
        const ctx = await requireActionContext();
        const plan = getPlan(ctx?.plan);
        const { count } = await supabase
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("status", "ativo");
        if ((count ?? 0) >= plan.limits.maxActiveProjects) {
          return fail(`O plano ${plan.name} permite ${plan.limits.maxActiveProjects} projetos ativos.`);
        }
      }
      const { data: project, error } = await supabase
        .from("projects")
        .update({ status, completed_at: status === "concluido" ? new Date().toISOString() : null })
        .eq("id", id)
        .select(PROJECT_COLUMNS)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!project) return fail("Este projeto não existe mais.");
      const message =
        status === "concluido" ? "Projeto concluído." : status === "arquivado" ? "Projeto arquivado." : "Projeto reativado.";
      return ok(project as Project, message);
    },
  );
}

export async function deleteProjectAction(input: { id: string }): Promise<ActionResult> {
  return runAction("projetos.excluir", z.object({ id: z.uuid() }), input, async ({ id }, { supabase }) => {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return ok(undefined, "Projeto excluído.");
  });
}

export type ProjectNote = { id: string; content: string; created_at: string };

export async function addProjectNoteAction(input: unknown): Promise<ActionResult<ProjectNote>> {
  return runAction(
    "projetos.ideia.criar",
    z.object({
      project_id: z.uuid(),
      content: z.string().trim().min(1, "Escreva a ideia.").max(4000, "Use até 4.000 caracteres."),
    }),
    input,
    async (data, { supabase }) => {
      const { data: note, error } = await supabase
        .from("project_notes")
        .insert(data)
        .select("id, content, created_at")
        .single();
      if (error || !note) {
        if (error?.code === "42501") return fail("Este projeto não existe mais.");
        throw new Error(error?.message ?? "ideia não registrada");
      }
      return ok(note as ProjectNote);
    },
  );
}

export async function deleteProjectNoteAction(input: { id: string }): Promise<ActionResult> {
  return runAction("projetos.ideia.excluir", z.object({ id: z.uuid() }), input, async ({ id }, { supabase }) => {
    const { error } = await supabase.from("project_notes").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return ok();
  });
}

/** Acrescenta várias etapas de uma vez (por exemplo, as sugeridas pela IA e aceitas pelo usuário). */
export async function addProjectStepsAction(input: unknown): Promise<ActionResult<Task[]>> {
  return runAction(
    "projetos.etapas.criar",
    z.object({
      project_id: z.uuid(),
      titles: z.array(z.string().trim().min(1).max(300)).min(1, "Escolha pelo menos uma etapa.").max(20),
    }),
    input,
    async ({ project_id, titles }, { supabase }) => {
      const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project_id);
      const start = count ?? 0;
      const { data: tasks, error } = await supabase
        .from("tasks")
        .insert(titles.map((title, index) => ({ project_id, title, position: start + index })))
        .select(TASK_COLUMNS);
      if (error || !tasks) {
        if (error?.code === "42501") return fail("Este projeto não existe mais.");
        throw new Error(error?.message ?? "etapas não criadas");
      }
      return ok(tasks as Task[], `${tasks.length} etapas adicionadas.`);
    },
  );
}
