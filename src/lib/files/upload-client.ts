import type { ApiErrorBody } from "@/lib/ai/protocol";
import type { AttachmentInfo } from "@/lib/types";

export type UploadResult =
  | { ok: true; file: AttachmentInfo; truncated: boolean; usage: { used: number; limit: number } }
  | { ok: false; message: string; aborted?: boolean };

/**
 * Envia um arquivo com progresso real (bytes enviados / total).
 * Usa XMLHttpRequest porque o fetch ainda não informa progresso de envio.
 */
export function uploadFile(
  file: File,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<UploadResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      let json: unknown = null;
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        json = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && json && typeof json === "object" && "file" in json) {
        const data = json as { file: AttachmentInfo; truncated: boolean; usage: { used: number; limit: number } };
        resolve({ ok: true, file: data.file, truncated: data.truncated, usage: data.usage });
      } else {
        const message =
          (json as ApiErrorBody | null)?.error?.message ??
          (xhr.status === 413
            ? "O arquivo é grande demais."
            : "Não foi possível enviar o arquivo. Tente de novo.");
        resolve({ ok: false, message });
      }
    };
    xhr.onerror = () => resolve({ ok: false, message: "Sem conexão. O arquivo não foi enviado." });
    xhr.onabort = () => resolve({ ok: false, message: "Envio cancelado.", aborted: true });
    signal.addEventListener("abort", () => xhr.abort(), { once: true });

    xhr.open("POST", "/api/files");
    xhr.send(form);
  });
}
