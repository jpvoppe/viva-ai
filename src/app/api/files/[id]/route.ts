import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { apiError, isSameOrigin } from "@/lib/api/respond";
import { ATTACHMENTS_BUCKET } from "@/lib/files/storage";

const idSchema = z.uuid();

/** Abre um anexo do próprio usuário por um link temporário (60 segundos). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return apiError("sessao_expirada", "Sua sessão expirou. Entre de novo para continuar.");
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return apiError("nao_encontrado", "Arquivo não encontrado.");

  const supabase = await createClient();
  const { data: file } = await supabase.from("files").select("storage_path").eq("id", id.data).maybeSingle();
  if (!file) return apiError("nao_encontrado", "Arquivo não encontrado.");

  const { data, error } = await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(file.storage_path, 60);
  if (error || !data?.signedUrl) {
    return apiError("armazenamento_indisponivel", "Não foi possível abrir o arquivo agora.", { retryable: true });
  }
  return Response.redirect(data.signedUrl, 302);
}

/** Remove um anexo que ainda não foi enviado em nenhuma mensagem. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return apiError("requisicao_invalida", "Origem não permitida.", { status: 403 });
  const user = await getSessionUser();
  if (!user) return apiError("sessao_expirada", "Sua sessão expirou. Entre de novo para continuar.");
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return apiError("nao_encontrado", "Arquivo não encontrado.");

  const supabase = await createClient();
  const { data: file } = await supabase.from("files").select("id, storage_path").eq("id", id.data).maybeSingle();
  if (!file) return apiError("nao_encontrado", "Arquivo não encontrado.");

  await supabase.storage.from(ATTACHMENTS_BUCKET).remove([file.storage_path]);
  const { error } = await supabase.from("files").delete().eq("id", file.id);
  if (error) return apiError("erro_interno", "Não foi possível remover o arquivo.", { retryable: true });
  return new Response(null, { status: 204 });
}
