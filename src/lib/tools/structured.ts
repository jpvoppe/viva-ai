import { z } from "zod";
import { STRUCTURED_LIMITS, type StructuredKind } from "./registry";

export const cardSchema = z.object({
  frente: z.string().trim().min(1).max(1000),
  verso: z.string().trim().min(1).max(2000),
});
export type GeneratedCard = z.infer<typeof cardSchema>;

export const quizQuestionSchema = z
  .object({
    pergunta: z.string().trim().min(1).max(600),
    opcoes: z.array(z.string().trim().min(1).max(300)).min(2).max(5),
    correta: z.number().int().min(0),
    explicacao: z.string().trim().max(800).default(""),
  })
  .refine((q) => q.correta < q.opcoes.length, { message: "índice da resposta correta fora das opções" });
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

export const stepSchema = z.object({ titulo: z.string().trim().min(1).max(300) });
export type GeneratedStep = z.infer<typeof stepSchema>;

export const structuredInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("cartoes"),
    assunto: z.string().trim().min(3, "Descreva o assunto.").max(3000, "Use até 3.000 caracteres."),
    nivel: z.enum(["iniciante", "intermediario", "avancado"]).default("intermediario"),
    quantidade: z.coerce.number().int().min(STRUCTURED_LIMITS.cartoes.min).max(STRUCTURED_LIMITS.cartoes.max).default(10),
  }),
  z.object({
    kind: z.literal("quiz"),
    assunto: z.string().trim().min(3, "Descreva o assunto.").max(3000, "Use até 3.000 caracteres."),
    nivel: z.enum(["iniciante", "intermediario", "avancado"]).default("intermediario"),
    quantidade: z.coerce.number().int().min(STRUCTURED_LIMITS.quiz.min).max(STRUCTURED_LIMITS.quiz.max).default(5),
  }),
  z.object({
    kind: z.literal("etapas"),
    nome: z.string().trim().min(1).max(120),
    objetivo: z.string().trim().max(2000).default(""),
  }),
]);
export type StructuredInput = z.infer<typeof structuredInputSchema>;

const LEVEL_TEXT = { iniciante: "iniciante", intermediario: "intermediário", avancado: "avançado" } as const;

export function structuredPrompt(input: StructuredInput): { instruction: string; prompt: string } {
  switch (input.kind) {
    case "cartoes":
      return {
        instruction:
          `Crie exatamente ${input.quantidade} cartões de estudo (flashcards) para o nível ${LEVEL_TEXT[input.nivel]}. ` +
          'Responda SOMENTE com JSON válido, sem texto antes ou depois, no formato: [{"frente":"pergunta curta","verso":"resposta objetiva"}]. ' +
          "Cada cartão testa uma única ideia. Use apenas fatos corretos; se o assunto for um texto fornecido, baseie-se só nele.",
        prompt: `Assunto ou texto-base:\n<texto>\n${input.assunto}\n</texto>`,
      };
    case "quiz":
      return {
        instruction:
          `Crie exatamente ${input.quantidade} perguntas de múltipla escolha para o nível ${LEVEL_TEXT[input.nivel]}. ` +
          'Responda SOMENTE com JSON válido, sem texto antes ou depois, no formato: [{"pergunta":"...","opcoes":["A","B","C","D"],"correta":0,"explicacao":"por que a correta está certa"}]. ' +
          "Cada pergunta tem 4 opções e só uma correta; “correta” é o índice (começando em 0). Varie a posição da resposta correta.",
        prompt: `Assunto ou texto-base:\n<texto>\n${input.assunto}\n</texto>`,
      };
    case "etapas":
      return {
        instruction:
          "Divida o projeto em etapas práticas, na ordem de execução, de 5 a 10 etapas. Cada etapa começa com um verbo e é algo que a pessoa consegue marcar como feito. " +
          'Responda SOMENTE com JSON válido, sem texto antes ou depois, no formato: [{"titulo":"..."}].',
        prompt: `<projeto>\nNome: ${input.nome}\nObjetivo: ${input.objetivo || "(não informado)"}\n</projeto>`,
      };
  }
}

export function parseStructured(kind: StructuredKind, json: unknown): unknown[] | null {
  if (!Array.isArray(json)) return null;
  const schema = kind === "cartoes" ? cardSchema : kind === "quiz" ? quizQuestionSchema : stepSchema;
  const items: unknown[] = [];
  for (const raw of json.slice(0, STRUCTURED_LIMITS[kind].max)) {
    const parsed = schema.safeParse(raw);
    if (parsed.success) items.push(parsed.data);
  }
  return items.length >= Math.min(STRUCTURED_LIMITS[kind].min, 2) ? items : null;
}
