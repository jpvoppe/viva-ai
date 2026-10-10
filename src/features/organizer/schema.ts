import { z } from "zod";
import { isIsoDate } from "@/lib/utils";

const optionalDate = z
  .union([z.literal(""), z.null(), z.string()])
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isIsoDate(v), "Data inválida.");

export const taskInputSchema = z.object({
  title: z.string().trim().min(1, "Escreva o que precisa ser feito.").max(300, "Use até 300 caracteres."),
  notes: z.string().trim().max(4000, "Use até 4.000 caracteres.").default(""),
  priority: z.coerce.number().int().min(1).max(3).default(2),
  due_date: optionalDate,
  recurrence: z.enum(["nenhuma", "diaria", "semanal", "mensal"]).default("nenhuma"),
  project_id: z
    .union([z.literal(""), z.null(), z.uuid()])
    .optional()
    .transform((v) => (v ? v : null)),
});

export type TaskInput = z.input<typeof taskInputSchema>;

export const PRIORITY_LABEL: Record<number, string> = { 1: "Alta", 2: "Média", 3: "Baixa" };
export const RECURRENCE_LABEL: Record<string, string> = {
  nenhuma: "Não repete",
  diaria: "Todo dia",
  semanal: "Toda semana",
  mensal: "Todo mês",
};

export const TASK_COLUMNS = "id, project_id, title, notes, priority, due_date, recurrence, completed_at, created_at";
