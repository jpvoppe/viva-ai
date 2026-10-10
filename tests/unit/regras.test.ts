import { describe, expect, it } from "vitest";
import { ageBandFor, ageOn, passwordSchema, signUpSchema } from "@/features/auth/schema";
import { nextReview } from "@/features/study/leitner";
import { extractListItems, markdownToPlainText, slugify } from "@/features/create/markdown-utils";
import { getPlan, isPlanId, PLANS, quotaLimit } from "@/lib/plans";
import { getTool, TOOLS, validateToolValues } from "@/lib/tools/registry";
import { parseStructured, structuredInputSchema, structuredPrompt } from "@/lib/tools/structured";
import { convertUnit, formatConverted, parseLocaleNumber, UNIT_CATEGORIES } from "@/lib/units";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { taskInputSchema } from "@/features/organizer/schema";

describe("idade no cadastro", () => {
  const today = new Date("2026-10-10T12:00:00Z");
  it("calcula anos completos", () => {
    expect(ageOn("2013-10-10", today)).toBe(13);
    expect(ageOn("2013-10-11", today)).toBe(12);
    expect(ageOn("2008-10-10", today)).toBe(18);
    expect(ageOn("2008-10-11", today)).toBe(17);
  });
  it("recusa datas impossíveis ou no futuro", () => {
    expect(ageOn("2026-02-30", today)).toBeNull();
    expect(ageOn("2030-01-01", today)).toBeNull();
    expect(ageOn("1800-01-01", today)).toBeNull();
  });
  it("define a faixa etária", () => {
    expect(ageBandFor(12)).toBeNull();
    expect(ageBandFor(13)).toBe("adolescente");
    expect(ageBandFor(17)).toBe("adolescente");
    expect(ageBandFor(18)).toBe("adulto");
  });
  it("exige senha com letras, número e 8 caracteres", () => {
    expect(passwordSchema.safeParse("abc12").success).toBe(false);
    expect(passwordSchema.safeParse("somenteletras").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
    expect(passwordSchema.safeParse("senha1234").success).toBe(true);
  });
  it("exige aceitar os termos", () => {
    const base = { name: "Ana", email: "ANA@Exemplo.com ", password: "senha1234", birthDate: "1990-01-01" };
    expect(signUpSchema.safeParse(base).success).toBe(false);
    const ok = signUpSchema.safeParse({ ...base, terms: "on" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.email).toBe("ana@exemplo.com");
  });
});

describe("repetição espaçada", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  it("acerto sobe de caixa e afasta a próxima revisão", () => {
    expect(nextReview(1, true, now)).toEqual({ box: 2, dueAt: new Date("2026-10-12T12:00:00Z") });
    expect(nextReview(4, true, now).box).toBe(5);
    expect(nextReview(5, true, now)).toEqual({ box: 5, dueAt: new Date("2026-10-26T12:00:00Z") });
  });
  it("erro volta para a caixa 1 e reaparece em minutos", () => {
    const result = nextReview(4, false, now);
    expect(result.box).toBe(1);
    expect(result.dueAt.getTime() - now.getTime()).toBe(10 * 60_000);
  });
});

describe("planos", () => {
  it("plano desconhecido cai no gratuito (nunca libera mais)", () => {
    expect(getPlan("premium-falso").id).toBe("gratuito");
    expect(getPlan(undefined).id).toBe("gratuito");
    expect(isPlanId("plus")).toBe(true);
  });
  it("planos pagos nunca têm limite menor que o gratuito", () => {
    for (const key of ["dailyMessages", "dailyGenerations", "dailyFiles", "maxFileBytes", "maxInputChars", "maxOutputTokens"] as const) {
      expect(PLANS.plus.limits[key]).toBeGreaterThanOrEqual(PLANS.gratuito.limits[key]);
      expect(PLANS.familia.limits[key]).toBeGreaterThanOrEqual(PLANS.gratuito.limits[key]);
    }
  });
  it("mapeia cada cota para o limite certo", () => {
    expect(quotaLimit(PLANS.gratuito, "mensagem")).toBe(PLANS.gratuito.limits.dailyMessages);
    expect(quotaLimit(PLANS.gratuito, "geracao")).toBe(PLANS.gratuito.limits.dailyGenerations);
    expect(quotaLimit(PLANS.gratuito, "arquivo")).toBe(PLANS.gratuito.limits.dailyFiles);
  });
});

describe("ferramentas de criação", () => {
  it("todas têm identificador único, campo obrigatório e instrução", () => {
    const ids = TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tool of TOOLS) {
      expect(tool.fields.some((f) => f.type !== "checkbox" && f.type !== "select" && f.required)).toBe(true);
      expect(tool.instruction.length).toBeGreaterThan(20);
      expect(tool.fields.some((f) => f.name === tool.titleFrom)).toBe(true);
    }
  });
  it("valida obrigatórios, tamanho e opções", () => {
    const tool = getTool("mensagem")!;
    expect(validateToolValues(tool, {})).toMatchObject({ ok: false, fieldErrors: { objetivo: "Preencha este campo." } });
    expect(validateToolValues(tool, { objetivo: "x".repeat(2000) }).ok).toBe(false);
    const ok = validateToolValues(tool, { objetivo: " avisar ", tom: "valor-inventado", extra: "ignorado" });
    expect(ok).toEqual({ ok: true, values: { objetivo: "avisar", destinatario: "", tom: "amigável", tamanho: "curto" } });
  });
  it("monta o pedido só com o que foi preenchido", () => {
    const tool = getTool("mensagem")!;
    const prompt = tool.buildPrompt({ objetivo: "avisar atraso", destinatario: "", tom: "formal", tamanho: "curto" });
    expect(prompt).toContain("O que comunicar: avisar atraso");
    expect(prompt).not.toContain("Destinatário");
  });
});

describe("gerações estruturadas", () => {
  it("aceita só itens no formato certo e limita a quantidade", () => {
    const raw = [
      { frente: "a", verso: "b" },
      { frente: "", verso: "sem pergunta" },
      { errado: true },
      { frente: "c", verso: "d" },
    ];
    expect(parseStructured("cartoes", raw)).toEqual([
      { frente: "a", verso: "b" },
      { frente: "c", verso: "d" },
    ]);
    expect(parseStructured("cartoes", { nao: "lista" })).toBeNull();
    expect(parseStructured("cartoes", [{ frente: "só um", verso: "x" }])).toBeNull();
    expect(parseStructured("cartoes", Array.from({ length: 50 }, () => ({ frente: "a", verso: "b" })))).toHaveLength(20);
  });
  it("recusa pergunta cuja resposta correta aponta para fora das opções", () => {
    const questions = [
      { pergunta: "1?", opcoes: ["a", "b"], correta: 5, explicacao: "" },
      { pergunta: "2?", opcoes: ["a", "b"], correta: 1, explicacao: "" },
      { pergunta: "3?", opcoes: ["a", "b"], correta: 0 },
    ];
    expect(parseStructured("quiz", questions)).toHaveLength(2);
  });
  it("valida a entrada e delimita o texto do usuário", () => {
    expect(structuredInputSchema.safeParse({ kind: "cartoes", assunto: "a" }).success).toBe(false);
    expect(structuredInputSchema.safeParse({ kind: "cartoes", assunto: "Biologia", quantidade: 500 }).success).toBe(false);
    const input = structuredInputSchema.parse({ kind: "quiz", assunto: "Biologia celular", quantidade: "5" });
    const { instruction, prompt } = structuredPrompt(input);
    expect(instruction).toContain("exatamente 5 perguntas");
    expect(prompt).toContain("<texto>\nBiologia celular\n</texto>");
  });
});

describe("conversor de unidades", () => {
  it("converte com exatidão", () => {
    expect(convertUnit("comprimento", 1, "km", "m")).toBe(1000);
    expect(convertUnit("comprimento", 1, "in", "cm")).toBeCloseTo(2.54, 10);
    expect(convertUnit("massa", 1, "arroba", "kg")).toBe(15);
    expect(convertUnit("massa", 1, "lb", "g")).toBeCloseTo(453.59237, 6);
    expect(convertUnit("volume", 2, "xicara", "ml")).toBeCloseTo(480, 10);
    expect(convertUnit("velocidade", 36, "kmh", "ms")).toBeCloseTo(10, 10);
    expect(convertUnit("area", 1, "ha", "m2")).toBe(10000);
    expect(convertUnit("tempo", 1, "d", "h")).toBe(24);
  });
  it("trata temperatura (não é só multiplicar)", () => {
    expect(convertUnit("temperatura", 100, "c", "f")).toBeCloseTo(212, 10);
    expect(convertUnit("temperatura", 32, "f", "c")).toBeCloseTo(0, 10);
    expect(convertUnit("temperatura", 0, "c", "k")).toBeCloseTo(273.15, 10);
    expect(convertUnit("temperatura", -40, "c", "f")).toBeCloseTo(-40, 10);
  });
  it("ida e volta dá o mesmo valor em todas as unidades", () => {
    for (const category of UNIT_CATEGORIES) {
      for (const from of category.units) {
        for (const to of category.units) {
          const there = convertUnit(category.id, 7.5, from.id, to.id)!;
          expect(convertUnit(category.id, there, to.id, from.id)).toBeCloseTo(7.5, 8);
        }
      }
    }
  });
  it("devolve nulo para entrada inválida", () => {
    expect(convertUnit("massa", Number.NaN, "kg", "g")).toBeNull();
    expect(convertUnit("massa", 1, "kg", "inexistente")).toBeNull();
  });
  it("entende número digitado à brasileira", () => {
    expect(parseLocaleNumber("1,5")).toBe(1.5);
    expect(parseLocaleNumber("1.234,56")).toBe(1234.56);
    expect(parseLocaleNumber("2.5")).toBe(2.5);
    expect(parseLocaleNumber("-3")).toBe(-3);
    expect(parseLocaleNumber("abc")).toBeNull();
    expect(parseLocaleNumber("")).toBeNull();
  });
  it("formata o resultado no padrão brasileiro", () => {
    expect(formatConverted(1234.5)).toBe("1.234,5");
    expect(formatConverted(0)).toBe("0");
    expect(formatConverted(0.001)).toBe("0,001");
  });
});

describe("texto das criações", () => {
  it("extrai itens de listas do Markdown", () => {
    const md = "**Hortifrúti**\n- Tomate\n- **Alface** crespa\n\n1. Arroz\n2) Feijão\n- [ ] Sabão\nTexto solto";
    expect(extractListItems(md)).toEqual(["Tomate", "Alface crespa", "Arroz", "Feijão", "Sabão"]);
  });
  it("converte Markdown em texto simples", () => {
    expect(markdownToPlainText("# Título\n\n**Negrito** e `código`\n- item\n[link](https://a.b)")).toBe(
      "Título\n\nNegrito e código\n• item\nlink (https://a.b)",
    );
  });
  it("gera nome de arquivo seguro", () => {
    expect(slugify("Reunião de Ação: Março/2026!")).toBe("reuniao-de-acao-marco-2026");
    expect(slugify("???")).toBe("viva");
  });
});

describe("validação de tarefas", () => {
  it("normaliza campos vazios e recusa data inválida", () => {
    const ok = taskInputSchema.parse({ title: "  Pagar conta  ", due_date: "", project_id: "" });
    expect(ok).toMatchObject({ title: "Pagar conta", due_date: null, project_id: null, priority: 2, recurrence: "nenhuma" });
    expect(taskInputSchema.safeParse({ title: "x", due_date: "2026-02-30" }).success).toBe(false);
    expect(taskInputSchema.safeParse({ title: "" }).success).toBe(false);
    expect(taskInputSchema.safeParse({ title: "x", priority: 9 }).success).toBe(false);
  });
});

describe("conquistas", () => {
  it("o catálogo tem códigos únicos (os mesmos do banco)", () => {
    const codes = ACHIEVEMENTS.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toContain("primeira_conversa");
    expect(codes).toContain("meta_semanal");
  });
});
