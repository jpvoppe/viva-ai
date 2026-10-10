import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getUserContext } from "@/lib/auth/session";
import { apiError, isSameOrigin } from "@/lib/api/respond";
import { checkRateLimit, RATE_RULES } from "@/lib/limits/rate-limit";
import { consumeQuota, refundQuota } from "@/lib/limits/quota";
import { getPlan } from "@/lib/plans";
import { detectFile, IMAGE_MAX_BYTES, sanitizeFileName, ACCEPTED_LABEL } from "@/lib/files/validate";
import { extractText, ExtractionError } from "@/lib/files/extract";
import { ATTACHMENTS_BUCKET, storagePathFor } from "@/lib/files/storage";
import { formatBytes } from "@/lib/utils";
import { logError } from "@/lib/log";
import { isServiceRoleConfigured } from "@/lib/env";

export const maxDuration = 60;

/** Envio de um anexo: valida, extrai o texto (documentos), guarda no armazenamento privado. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("requisicao_invalida", "Origem não permitida.", { status: 403 });
  const user = await getSessionUser();
  if (!user) return apiError("sessao_expirada", "Sua sessão expirou. Entre de novo para continuar.");
  const ctx = await getUserContext();
  if (!ctx) return apiError("sessao_expirada", "Sua sessão expirou. Entre de novo para continuar.");
  if (ctx.flags.anexos === false) {
    return apiError("recurso_desativado", "O envio de arquivos está desativado no momento.");
  }
  if (!isServiceRoleConfigured()) {
    return apiError("armazenamento_indisponivel", "O envio de arquivos ainda não foi configurado neste ambiente.");
  }
  if (!(await checkRateLimit(`upload:${user.id}`, RATE_RULES.upload))) {
    return apiError("muitas_requisicoes", "Muitos envios em pouco tempo. Aguarde um minuto.", { retryable: true });
  }

  const plan = getPlan(ctx.plan);
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > plan.limits.maxFileBytes + 64 * 1024) {
    return apiError("arquivo_invalido", `O arquivo passa do limite de ${formatBytes(plan.limits.maxFileBytes)} do seu plano.`);
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const entry = form.get("file");
    if (entry instanceof File) file = entry;
  } catch {
    return apiError("requisicao_invalida", "Não foi possível ler o arquivo enviado.");
  }
  if (!file || file.size === 0) return apiError("arquivo_invalido", "O arquivo está vazio.");
  if (file.size > plan.limits.maxFileBytes) {
    return apiError("arquivo_invalido", `O arquivo passa do limite de ${formatBytes(plan.limits.maxFileBytes)} do seu plano.`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = sanitizeFileName(file.name);
  const detected = detectFile(bytes, name);
  if (!detected) {
    return apiError("arquivo_invalido", `Tipo de arquivo não aceito. Envie ${ACCEPTED_LABEL}.`);
  }
  if (detected.kind === "imagem" && bytes.length > IMAGE_MAX_BYTES) {
    return apiError("arquivo_invalido", `Imagens podem ter até ${formatBytes(IMAGE_MAX_BYTES)}.`);
  }

  let extracted: { text: string; truncated: boolean } | null = null;
  if (detected.kind === "documento") {
    try {
      extracted = await extractText(bytes, detected);
    } catch (error) {
      if (error instanceof ExtractionError) return apiError("arquivo_invalido", error.message);
      await logError("arquivos.extrair", error);
      return apiError("arquivo_invalido", "Não foi possível ler o conteúdo deste arquivo.");
    }
  }

  const quota = await consumeQuota(user.id, ctx.plan, "arquivo", ctx.profile.timezone);
  if (!quota.allowed) {
    return apiError(
      "limite_plano",
      `Você já enviou ${quota.limit} arquivos hoje, o limite do plano ${plan.name}. O limite volta amanhã.`,
      { usage: { used: quota.used, limit: quota.limit } },
    );
  }

  const supabase = await createClient();
  const id = randomUUID();
  const path = storagePathFor(user.id, id, detected.ext);
  const upload = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, bytes, {
    contentType: detected.mime,
    upsert: false,
  });
  if (upload.error) {
    await refundQuota(user.id, "arquivo", quota.period);
    await logError("arquivos.enviar", upload.error);
    return apiError("armazenamento_indisponivel", "Não foi possível guardar o arquivo agora. Tente de novo.", {
      retryable: true,
    });
  }

  const { error: insertError } = await supabase.from("files").insert({
    id,
    name,
    mime_type: detected.mime,
    size_bytes: bytes.length,
    kind: detected.kind,
    storage_path: path,
    extracted_text: extracted?.text ?? null,
    text_truncated: extracted?.truncated ?? false,
  });
  if (insertError) {
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove([path]);
    await refundQuota(user.id, "arquivo", quota.period);
    await logError("arquivos.registrar", insertError);
    return apiError("erro_interno", "Não foi possível registrar o arquivo. Tente de novo.", { retryable: true });
  }

  return Response.json(
    {
      file: { id, name, kind: detected.kind, size_bytes: bytes.length, mime_type: detected.mime },
      truncated: extracted?.truncated ?? false,
      usage: { used: quota.used, limit: quota.limit },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
