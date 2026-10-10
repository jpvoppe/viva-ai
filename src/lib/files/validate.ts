/**
 * Validação de arquivos pelo CONTEÚDO (assinatura dos primeiros bytes),
 * não só pela extensão ou pelo tipo informado pelo navegador.
 */

export type FileKind = "imagem" | "documento";
export type DetectedFile = {
  kind: FileKind;
  mime:
    | "image/png"
    | "image/jpeg"
    | "image/webp"
    | "image/gif"
    | "application/pdf"
    | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    | "text/plain"
    | "text/markdown"
    | "text/csv";
  ext: string;
};

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const ACCEPT_ATTRIBUTE = ".png,.jpg,.jpeg,.webp,.gif,.pdf,.docx,.txt,.md,.csv";
export const ACCEPTED_LABEL = "PNG, JPG, WEBP, GIF, PDF, DOCX, TXT, MD e CSV";

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((b, i) => bytes[offset + i] === b);
}

export function extensionOf(name: string): string {
  const match = /\.([a-z0-9]{1,8})$/i.exec(name.trim());
  return match ? match[1].toLowerCase() : "";
}

export function detectFile(bytes: Uint8Array, name: string): DetectedFile | null {
  const ext = extensionOf(name);

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { kind: "imagem", mime: "image/png", ext: "png" };
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { kind: "imagem", mime: "image/jpeg", ext: "jpg" };
  }
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { kind: "imagem", mime: "image/webp", ext: "webp" };
  }
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) {
    return { kind: "imagem", mime: "image/gif", ext: "gif" };
  }
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { kind: "documento", mime: "application/pdf", ext: "pdf" };
  }
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    // Arquivo ZIP: só aceitamos se for .docx (o conteúdo é conferido na extração).
    if (ext === "docx") {
      return {
        kind: "documento",
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ext: "docx",
      };
    }
    return null;
  }

  if (ext === "txt" || ext === "md" || ext === "csv") {
    if (!looksLikeText(bytes)) return null;
    const mime = ext === "md" ? "text/markdown" : ext === "csv" ? "text/csv" : "text/plain";
    return { kind: "documento", mime, ext };
  }
  return null;
}

/** Texto de verdade não tem byte nulo nem muitos caracteres de controle. */
export function looksLikeText(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, 8192);
  if (sample.length === 0) return false;
  let control = 0;
  for (const b of sample) {
    if (b === 0) return false;
    if (b < 9 || (b > 13 && b < 32)) control++;
  }
  return control / sample.length < 0.02;
}

/** Decodifica texto: UTF-8 primeiro; se falhar, Windows-1252 (comum em CSV exportado de sistemas). */
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** Nome seguro para exibir e guardar (sem caminhos nem caracteres de controle). */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "arquivo";
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200);
  return clean || "arquivo";
}
