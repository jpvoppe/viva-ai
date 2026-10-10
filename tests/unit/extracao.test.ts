// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractText, ExtractionError, MAX_EXTRACTED_CHARS } from "@/lib/files/extract";
import { detectFile } from "@/lib/files/validate";

const load = (name: string) => new Uint8Array(readFileSync(`tests/fixtures/${name}`));

describe("extração de texto dos anexos", () => {
  it("lê PDF com texto", async () => {
    const bytes = load("relatorio.pdf");
    const detected = detectFile(bytes, "relatorio.pdf")!;
    const { text, truncated } = await extractText(bytes, detected);
    expect(text).toContain("faturamento de marco foi 12345 reais");
    expect(truncated).toBe(false);
  });

  it("lê Word (.docx)", async () => {
    const bytes = load("documento.docx");
    const { text } = await extractText(bytes, detectFile(bytes, "documento.docx")!);
    expect(text).toContain("decidimos lançar em dezembro");
  });

  it("lê CSV antigo em Windows-1252 sem estragar os acentos", async () => {
    const bytes = load("dados-latin1.csv");
    const { text } = await extractText(bytes, detectFile(bytes, "dados-latin1.csv")!);
    expect(text).toContain("maçã;4,50");
    expect(text).toContain("pão");
  });

  it("corta textos gigantes e avisa que cortou", async () => {
    const bytes = new TextEncoder().encode("a".repeat(MAX_EXTRACTED_CHARS + 500));
    const { text, truncated } = await extractText(bytes, detectFile(bytes, "grande.txt")!);
    expect(text).toHaveLength(MAX_EXTRACTED_CHARS);
    expect(truncated).toBe(true);
  });

  it("explica quando o arquivo não pode ser lido", async () => {
    const corrupt = new TextEncoder().encode("%PDF-1.4 isto não é um PDF de verdade");
    await expect(extractText(corrupt, detectFile(corrupt, "ruim.pdf")!)).rejects.toBeInstanceOf(ExtractionError);

    const fakeDocx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4]);
    await expect(extractText(fakeDocx, detectFile(fakeDocx, "falso.docx")!)).rejects.toBeInstanceOf(ExtractionError);

    const blank = new TextEncoder().encode("   \n  ");
    await expect(extractText(blank, detectFile(blank, "vazio.txt")!)).rejects.toThrow("vazio");
  });
});
