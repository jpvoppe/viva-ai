import "server-only";
import { decodeText, type DetectedFile } from "./validate";

export const MAX_EXTRACTED_CHARS = 200_000;

export class ExtractionError extends Error {}

/** Extrai o texto de um documento para servir de contexto à IA. */
export async function extractText(
  bytes: Uint8Array,
  detected: DetectedFile,
): Promise<{ text: string; truncated: boolean }> {
  let text: string;

  if (detected.mime === "application/pdf") {
    try {
      const { extractText: pdfText } = await import("unpdf");
      const result = await pdfText(new Uint8Array(bytes), { mergePages: true });
      text = Array.isArray(result.text) ? result.text.join("\n\n") : result.text;
    } catch {
      throw new ExtractionError("Não foi possível ler este PDF. Ele pode estar protegido por senha ou corrompido.");
    }
    if (text.replace(/\s/g, "").length < 20) {
      throw new ExtractionError(
        "Este PDF não tem texto selecionável (parece digitalizado). Envie as páginas como imagem ou um PDF com texto.",
      );
    }
  } else if (detected.ext === "docx") {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      text = result.value;
    } catch {
      throw new ExtractionError("Não foi possível ler este arquivo do Word. Confira se ele abre normalmente.");
    }
    if (text.trim().length === 0) {
      throw new ExtractionError("Este documento do Word está vazio.");
    }
  } else {
    text = decodeText(bytes);
    if (text.trim().length === 0) {
      throw new ExtractionError("Este arquivo de texto está vazio.");
    }
  }

  // Bytes nulos não são aceitos pelo banco.
  text = text.replace(/\u0000/g, "").replace(/\r\n/g, "\n");
  const truncated = text.length > MAX_EXTRACTED_CHARS;
  return { text: truncated ? text.slice(0, MAX_EXTRACTED_CHARS) : text, truncated };
}
