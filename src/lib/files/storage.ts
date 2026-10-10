export const ATTACHMENTS_BUCKET = "anexos";

/** Caminho no armazenamento: a primeira pasta é sempre o id do dono (as políticas dependem disso). */
export function storagePathFor(userId: string, fileId: string, ext: string): string {
  return `${userId}/${fileId}.${ext}`;
}
