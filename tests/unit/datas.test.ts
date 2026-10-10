import { describe, expect, it } from "vitest";
import { addDays, addMonths, formatBytes, isIsoDate, safeInternalPath, todayInTimeZone, truncate } from "@/lib/utils";
import { daysBetween, describeDueDate, nextOccurrence } from "@/features/organizer/dates";

describe("datas", () => {
  it("calcula o dia de hoje no fuso do usuário, não no do servidor", () => {
    const instant = new Date("2026-03-01T02:30:00Z"); // ainda é 28/02 em São Paulo
    expect(todayInTimeZone("America/Sao_Paulo", instant)).toBe("2026-02-28");
    expect(todayInTimeZone("Asia/Tokyo", instant)).toBe("2026-03-01");
  });

  it("usa São Paulo quando o fuso é inválido", () => {
    expect(todayInTimeZone("Fuso/Inexistente", new Date("2026-03-01T12:00:00Z"))).toBe("2026-03-01");
  });

  it("soma dias atravessando mês, ano e ano bissexto", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("soma meses sem estourar o último dia", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-15", 2)).toBe("2027-01-15");
  });

  it("valida datas reais", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("28/02/2026")).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });

  it("conta dias entre datas", () => {
    expect(daysBetween("2026-10-10", "2026-10-17")).toBe(7);
    expect(daysBetween("2026-10-10", "2026-10-09")).toBe(-1);
  });

  it("descreve o prazo em relação a hoje", () => {
    const today = "2026-10-10"; // sábado
    expect(describeDueDate("2026-10-10", today)).toBe("Hoje");
    expect(describeDueDate("2026-10-11", today)).toBe("Amanhã");
    expect(describeDueDate("2026-10-09", today)).toBe("Ontem");
    expect(describeDueDate("2026-10-14", today)).toBe("quarta");
    expect(describeDueDate("2026-11-03", today)).toBe("3 de nov");
    expect(describeDueDate("2027-01-05", today)).toBe("5 de jan de 2027");
  });
});

describe("tarefas que se repetem", () => {
  const today = "2026-10-10";
  it("não repete quando a tarefa não é recorrente", () => {
    expect(nextOccurrence("nenhuma", "2026-10-10", today)).toBeNull();
  });
  it("avança um período a partir do prazo", () => {
    expect(nextOccurrence("diaria", "2026-10-10", today)).toBe("2026-10-11");
    expect(nextOccurrence("semanal", "2026-10-10", today)).toBe("2026-10-17");
    expect(nextOccurrence("mensal", "2026-10-31", today)).toBe("2026-11-30");
  });
  it("tarefa atrasada pula para a próxima data futura, sem empilhar atrasos", () => {
    expect(nextOccurrence("semanal", "2026-09-05", today)).toBe("2026-10-17");
    expect(nextOccurrence("diaria", "2026-10-01", today)).toBe("2026-10-11");
  });
  it("sem prazo, conta a partir de hoje", () => {
    expect(nextOccurrence("diaria", null, today)).toBe("2026-10-11");
  });
});

describe("utilitários de texto", () => {
  it("formata tamanhos de arquivo", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5,0 MB");
  });
  it("corta texto longo com reticências", () => {
    expect(truncate("  um   texto  curto ", 50)).toBe("um texto curto");
    expect(truncate("a".repeat(20), 10)).toHaveLength(10);
  });
  it("só aceita redirecionamento para caminhos internos", () => {
    expect(safeInternalPath("/app/projetos")).toBe("/app/projetos");
    expect(safeInternalPath("https://malicioso.example")).toBe("/app");
    expect(safeInternalPath("//malicioso.example")).toBe("/app");
    expect(safeInternalPath("/\\malicioso.example")).toBe("/app");
    expect(safeInternalPath(null, "/entrar")).toBe("/entrar");
  });
});
