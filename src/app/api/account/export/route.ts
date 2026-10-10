import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { apiError } from "@/lib/api/respond";
import { checkRateLimit, RATE_RULES } from "@/lib/limits/rate-limit";

const TABLES: { name: string; columns: string; limit: number }[] = [
  { name: "profiles", columns: "display_name, age_band, locale, timezone, terms_accepted_at, created_at", limit: 1 },
  { name: "user_preferences", columns: "theme, response_style, goals, enter_to_send, memory_enabled, gamification_enabled, weekly_task_goal, voice_reply", limit: 1 },
  { name: "subscriptions", columns: "plan, status, current_period_end, cancel_at_period_end", limit: 1 },
  { name: "memories", columns: "content, created_at", limit: 1000 },
  { name: "projects", columns: "id, name, goal, status, completed_at, created_at", limit: 1000 },
  { name: "project_notes", columns: "project_id, content, created_at", limit: 5000 },
  { name: "tasks", columns: "project_id, title, notes, priority, due_date, recurrence, completed_at, created_at", limit: 5000 },
  { name: "lists", columns: "id, name, kind, created_at", limit: 1000 },
  { name: "list_items", columns: "list_id, text, done", limit: 10000 },
  { name: "goals", columns: "title, unit, target_value, current_value, due_date, completed_at, created_at", limit: 1000 },
  { name: "conversations", columns: "id, title, project_id, created_at", limit: 5000 },
  { name: "messages", columns: "conversation_id, role, content, status, feedback, created_at", limit: 20000 },
  { name: "files", columns: "name, mime_type, size_bytes, kind, created_at", limit: 5000 },
  { name: "documents", columns: "tool, title, content, created_at, updated_at", limit: 2000 },
  { name: "study_decks", columns: "id, title, level, created_at", limit: 1000 },
  { name: "flashcards", columns: "deck_id, front, back, box, review_count", limit: 10000 },
  { name: "quizzes", columns: "id, title, questions, created_at", limit: 1000 },
  { name: "quiz_attempts", columns: "quiz_id, score, total, created_at", limit: 5000 },
  { name: "user_achievements", columns: "code, unlocked_at", limit: 100 },
  { name: "feedback", columns: "category, comment, created_at", limit: 1000 },
];

/**
 * Exportação dos dados do usuário (portabilidade, LGPD art. 18).
 * Lê tudo com a sessão do próprio usuário: o RLS garante que só vêm os dados dele.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return apiError("sessao_expirada", "Sua sessão expirou. Entre de novo para continuar.");
  if (!(await checkRateLimit(`exportar:${user.id}`, RATE_RULES.export))) {
    return apiError("muitas_requisicoes", "Você já exportou seus dados várias vezes na última hora. Tente mais tarde.");
  }

  const supabase = await createClient();
  const data: Record<string, unknown> = {};
  const truncated: string[] = [];
  for (const table of TABLES) {
    const { data: rows, error } = await supabase.from(table.name).select(table.columns).limit(table.limit);
    if (error) return apiError("erro_interno", "Não foi possível montar a exportação agora. Tente de novo.", { retryable: true });
    data[table.name] = rows ?? [];
    if ((rows?.length ?? 0) >= table.limit && table.limit > 1) truncated.push(table.name);
  }

  const body = JSON.stringify(
    {
      exportado_em: new Date().toISOString(),
      conta: { email: user.email },
      observacao:
        "Exportação dos seus dados no VIVA AI. Os arquivos anexados não vão neste pacote: baixe-os nas próprias conversas." +
        (truncated.length ? ` Tabelas cortadas por tamanho: ${truncated.join(", ")}.` : ""),
      dados: data,
    },
    null,
    2,
  );

  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="viva-meus-dados-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
