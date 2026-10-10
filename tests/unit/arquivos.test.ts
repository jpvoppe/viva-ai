// @vitest-environment node
import { describe, expect, it } from "vitest";
import { decodeText, detectFile, extensionOf, looksLikeText, sanitizeFileName } from "@/lib/files/validate";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);

describe("validação de arquivos pelo conteúdo", () => {
  it("reconhece imagens pela assinatura, não pela extensão", () => {
    expect(detectFile(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0), "foto.txt")?.mime).toBe("image/png");
    expect(detectFile(bytes(0xff, 0xd8, 0xff, 0xe0), "x")?.mime).toBe("image/jpeg");
    expect(detectFile(bytes(0x47, 0x49, 0x46, 0x38, 0x39), "x.gif")?.mime).toBe("image/gif");
    expect(detectFile(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50), "x.webp")?.mime).toBe("image/webp");
  });

  it("reconhece PDF e DOCX", () => {
    expect(detectFile(text("%PDF-1.7 ..."), "doc.pdf")?.mime).toBe("application/pdf");
    expect(detectFile(bytes(0x50, 0x4b, 0x03, 0x04, 0), "texto.docx")?.ext).toBe("docx");
  });

  it("recusa executável renomeado e ZIP comum", () => {
    expect(detectFile(bytes(0x4d, 0x5a, 0x90, 0x00, 0x03), "relatorio.pdf")).toBeNull(); // .exe com nome de PDF
    expect(detectFile(bytes(0x4d, 0x5a, 0x90, 0x00, 0x00), "notas.txt")).toBeNull(); // binário com nome de texto
    expect(detectFile(bytes(0x50, 0x4b, 0x03, 0x04, 0), "arquivos.zip")).toBeNull();
    expect(detectFile(text("<html>"), "pagina.html")).toBeNull();
  });

  it("aceita texto só nas extensões permitidas", () => {
    expect(detectFile(text("nome;valor\nA;1"), "dados.csv")?.mime).toBe("text/csv");
    expect(detectFile(text("# título"), "notas.MD")?.mime).toBe("text/markdown");
    expect(detectFile(text("olá"), "sem-extensao")).toBeNull();
    expect(detectFile(new Uint8Array(0), "vazio.txt")).toBeNull();
  });

  it("distingue texto de binário", () => {
    expect(looksLikeText(text("linha 1\nlinha 2\tcom tab"))).toBe(true);
    expect(looksLikeText(bytes(72, 0, 73))).toBe(false);
  });

  it("decodifica UTF-8 e, se falhar, Windows-1252 (CSV de sistemas antigos)", () => {
    expect(decodeText(text("ação"))).toBe("ação");
    expect(decodeText(bytes(0x61, 0xe7, 0xe3, 0x6f))).toBe("ação");
  });

  it("limpa o nome do arquivo", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\Users\\a\\nota\u0000.txt")).toBe("nota.txt");
    expect(sanitizeFileName("")).toBe("arquivo");
    expect(extensionOf("Relatório.Final.PDF")).toBe("pdf");
  });
});
