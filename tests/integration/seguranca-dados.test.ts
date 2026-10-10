import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, createTestUser, deleteTestUsers, hasTestDatabase, type TestUser } from "../helpers/supabase";

/**
 * Proteção de dados entre usuários, testada direto no banco (RLS):
 * mesmo que alguém ignore a interface e chame a API do banco com a própria
 * sessão, não lê nem altera nada de outra conta.
 */
describe.skipIf(!hasTestDatabase)("isolamento de dados entre usuários (RLS)", () => {
  let ana: TestUser;
  let bruno: TestUser;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    ana = await createTestUser("ana");
    bruno = await createTestUser("bruno");

    const one = async (table: string, row: Record<string, unknown>) => {
      const { data, error } = await ana.client.from(table).insert(row).select("id").single();
      if (error) throw new Error(`${table}: ${error.message}`);
      return data.id as string;
    };
    ids.project = await one("projects", { name: "Projeto da Ana", goal: "segredo" });
    ids.task = await one("tasks", { title: "Tarefa da Ana", project_id: ids.project });
    ids.note = await one("project_notes", { project_id: ids.project, content: "ideia da Ana" });
    ids.conversation = await one("conversations", { title: "Conversa da Ana" });
    ids.message = await one("messages", { conversation_id: ids.conversation, role: "user", content: "mensagem privada da Ana" });
    ids.memory = await one("memories", { content: "memória da Ana" });
    ids.list = await one("lists", { name: "Lista da Ana" });
    ids.item = await one("list_items", { list_id: ids.list, text: "item da Ana" });
    ids.goal = await one("goals", { title: "Objetivo da Ana", target_value: 10 });
    ids.document = await one("documents", { tool: "mensagem", title: "Texto da Ana", content: "conteúdo" });
    ids.deck = await one("study_decks", { title: "Baralho da Ana" });
    ids.card = await one("flashcards", { deck_id: ids.deck, front: "p", back: "r" });
    ids.quiz = await one("quizzes", { title: "Quiz da Ana", questions: [{ pergunta: "?", opcoes: ["a", "b"], correta: 0 }] });
    ids.file = await one("files", { name: "a.txt", mime_type: "text/plain", size_bytes: 3, kind: "documento", storage_path: `${ana.id}/a.txt`, extracted_text: "abc" });
    ids.feedback = await one("feedback", { comment: "comentário da Ana" });
  });

  afterAll(async () => {
    await deleteTestUsers();
  });

  const OWNED_TABLES: [string, string][] = [
    ["projects", "project"], ["tasks", "task"], ["project_notes", "note"], ["conversations", "conversation"],
    ["messages", "message"], ["memories", "memory"], ["lists", "list"], ["list_items", "item"], ["goals", "goal"],
    ["documents", "document"], ["study_decks", "deck"], ["flashcards", "card"], ["quizzes", "quiz"], ["files", "file"],
    ["feedback", "feedback"],
  ];

  it.each(OWNED_TABLES)("outro usuário não lê %s", async (table, key) => {
    const { data, error } = await bruno.client.from(table).select("id").eq("id", ids[key]);
    expect(error).toBeNull();
    expect(data).toEqual([]);
    const all = await bruno.client.from(table).select("id");
    expect(all.data).toEqual([]);
  });

  it.each(OWNED_TABLES)("visitante sem login não lê %s", async (table) => {
    const { data } = await anonClient().from(table).select("id");
    expect(data ?? []).toEqual([]);
  });

  it("outro usuário não altera nem apaga linhas alheias", async () => {
    const update = await bruno.client.from("projects").update({ name: "invadido" }).eq("id", ids.project).select("id");
    expect(update.data ?? []).toEqual([]);
    const remove = await bruno.client.from("tasks").delete().eq("id", ids.task).select("id");
    expect(remove.data ?? []).toEqual([]);
    const removeConversation = await bruno.client.from("conversations").delete().eq("id", ids.conversation).select("id");
    expect(removeConversation.data ?? []).toEqual([]);

    const { data: still } = await ana.client.from("projects").select("name").eq("id", ids.project).single();
    expect(still?.name).toBe("Projeto da Ana");
    const { data: task } = await ana.client.from("tasks").select("id").eq("id", ids.task);
    expect(task).toHaveLength(1);
  });

  it("não dá para pendurar dados em conversa, projeto, lista ou baralho de outra pessoa", async () => {
    const attempts = await Promise.all([
      bruno.client.from("messages").insert({ conversation_id: ids.conversation, role: "user", content: "intruso" }),
      bruno.client.from("tasks").insert({ title: "intrusa", project_id: ids.project }),
      bruno.client.from("project_notes").insert({ project_id: ids.project, content: "intrusa" }),
      bruno.client.from("list_items").insert({ list_id: ids.list, text: "intruso" }),
      bruno.client.from("flashcards").insert({ deck_id: ids.deck, front: "x", back: "y" }),
      bruno.client.from("quiz_attempts").insert({ quiz_id: ids.quiz, score: 1, total: 1 }),
      bruno.client.from("conversations").insert({ title: "x", project_id: ids.project }),
      bruno.client.from("message_files").insert({ message_id: ids.message, file_id: ids.file }),
    ]);
    for (const attempt of attempts) expect(attempt.error).not.toBeNull();
  });

  it("não dá para criar uma linha em nome de outro usuário", async () => {
    const { error } = await bruno.client.from("projects").insert({ name: "falso", user_id: ana.id });
    expect(error).not.toBeNull();
    const file = await bruno.client.from("files").insert({ name: "x", mime_type: "text/plain", size_bytes: 1, kind: "documento", storage_path: `${ana.id}/x.txt` });
    expect(file.error).not.toBeNull();
  });

  it("ninguém se promove a administrador nem muda a própria faixa etária", async () => {
    const role = await bruno.client.from("profiles").update({ role: "admin" }).eq("id", bruno.id);
    expect(role.error).not.toBeNull();
    const age = await bruno.client.from("profiles").update({ age_band: "adulto" }).eq("id", bruno.id);
    expect(age.error).not.toBeNull();
    const { data } = await bruno.client.from("profiles").select("role").eq("id", bruno.id).single();
    expect(data?.role).toBe("user");
    // O que ele pode mudar: o próprio nome.
    const name = await bruno.client.from("profiles").update({ display_name: "Bruno B." }).eq("id", bruno.id);
    expect(name.error).toBeNull();
    // E não enxerga o perfil dos outros.
    const others = await bruno.client.from("profiles").select("id");
    expect(others.data).toHaveLength(1);
  });

  it("ninguém se dá um plano pago, zera a própria cota ou apaga registros de consumo", async () => {
    const plan = await bruno.client.from("subscriptions").update({ plan: "plus" }).eq("user_id", bruno.id);
    expect(plan.error).not.toBeNull();
    const insertPlan = await bruno.client.from("subscriptions").insert({ user_id: bruno.id, plan: "plus" });
    expect(insertPlan.error).not.toBeNull();
    const counter = await bruno.client.from("usage_counters").insert({ user_id: bruno.id, kind: "mensagem", period_start: "2026-01-01", count: 0 });
    expect(counter.error).not.toBeNull();
    const usage = await bruno.client.from("usage_events").select("id");
    expect(usage.error).not.toBeNull();
    const { data } = await bruno.client.rpc("my_plan");
    expect(data).toBe("gratuito");
  });

  it("funções internas (cota, limite, orçamento) não podem ser chamadas pelo navegador", async () => {
    const calls = await Promise.all([
      bruno.client.rpc("consume_quota", { p_user: bruno.id, p_kind: "mensagem", p_period: "2026-01-01", p_limit: 999999 }),
      bruno.client.rpc("refund_quota", { p_user: bruno.id, p_kind: "mensagem", p_period: "2026-01-01" }),
      bruno.client.rpc("rate_limit_hit", { p_key: "x", p_window_seconds: 60, p_max: 1 }),
      bruno.client.rpc("effective_plan", { p_user: ana.id }),
      bruno.client.rpc("log_activity", { p_user: bruno.id, p_kind: "tarefa_concluida" }),
      bruno.client.rpc("ai_spend_since", { p_since: "2026-01-01T00:00:00Z" }),
    ]);
    for (const call of calls) expect(call.error).not.toBeNull();
  });

  it("o painel administrativo recusa quem não é administrador", async () => {
    for (const fn of ["admin_overview", "admin_usage_daily", "admin_feature_usage", "admin_recent_errors", "admin_feedback", "admin_billing_events", "admin_audit"]) {
      const { error } = await bruno.client.rpc(fn);
      expect(error, fn).not.toBeNull();
    }
    const flag = await bruno.client.rpc("admin_set_flag", { p_key: "assistente", p_enabled: false });
    expect(flag.error).not.toBeNull();
    const direct = await bruno.client.from("feature_flags").update({ enabled: false }).eq("key", "assistente");
    expect(direct.error).not.toBeNull();
    const logs = await bruno.client.from("error_logs").select("id");
    expect(logs.error).not.toBeNull();
    const audit = await bruno.client.from("admin_audit_log").select("id");
    expect(audit.error).not.toBeNull();
  });

  it("um administrador de verdade acessa os números e a mudança fica na auditoria", async () => {
    const admin = adminClient();
    await admin.from("profiles").update({ role: "admin" }).eq("id", ana.id);
    try {
      const overview = await ana.client.rpc("admin_overview");
      expect(overview.error).toBeNull();
      expect(overview.data.usuarios_total).toBeGreaterThanOrEqual(2);
      // O resumo é agregado: não contém e-mails nem textos de usuários.
      expect(JSON.stringify(overview.data)).not.toContain("@");
      expect(JSON.stringify(overview.data)).not.toContain("mensagem privada");

      const off = await ana.client.rpc("admin_set_flag", { p_key: "pesquisa_web", p_enabled: true });
      expect(off.error).toBeNull();
      const audit = await ana.client.rpc("admin_audit", { p_limit: 5 });
      expect(audit.data?.[0]).toMatchObject({ action: "alterar_recurso", detail: "pesquisa_web = true" });
    } finally {
      await admin.from("feature_flags").update({ enabled: false }).eq("key", "pesquisa_web");
      await admin.from("profiles").update({ role: "user" }).eq("id", ana.id);
    }
  });

  it("o conteúdo de uma mensagem não pode ser reescrito depois; só a avaliação", async () => {
    const edit = await ana.client.from("messages").update({ content: "alterada" }).eq("id", ids.message);
    expect(edit.error).not.toBeNull();
    const vote = await ana.client.from("messages").update({ feedback: 1 }).eq("id", ids.message);
    expect(vote.error).toBeNull();
  });

  it("a busca no histórico só devolve conversas do próprio usuário", async () => {
    const mine = await ana.client.rpc("search_conversations", { p_query: "privada" });
    expect(mine.error).toBeNull();
    expect(mine.data?.map((r: { id: string }) => r.id)).toContain(ids.conversation);
    const theirs = await bruno.client.rpc("search_conversations", { p_query: "privada" });
    expect(theirs.data).toEqual([]);
    const byTitle = await bruno.client.rpc("search_conversations", { p_query: "Conversa da Ana" });
    expect(byTitle.data).toEqual([]);
    // Caracteres especiais de busca não quebram nem vazam nada.
    const tricky = await bruno.client.rpc("search_conversations", { p_query: "%' OR 1=1 --" });
    expect(tricky.error).toBeNull();
    expect(tricky.data).toEqual([]);
  });

  it("o contexto do usuário não traz dados de outra conta", async () => {
    const { data } = await bruno.client.rpc("my_context");
    expect(data.profile.id).toBe(bruno.id);
    expect(data.plan).toBe("gratuito");
    expect(JSON.stringify(data)).not.toContain(ana.id);
    const anon = await anonClient().rpc("my_context");
    expect(anon.data ?? null).toBeNull();
  });

  it("anexos: cada um só acessa a própria pasta no armazenamento", async () => {
    const path = `${ana.id}/teste-${Date.now()}.txt`;
    const upload = await ana.client.storage.from("anexos").upload(path, new Blob(["segredo da Ana"], { type: "text/plain" }));
    expect(upload.error).toBeNull();

    const read = await bruno.client.storage.from("anexos").download(path);
    expect(read.error).not.toBeNull();
    const signed = await bruno.client.storage.from("anexos").createSignedUrl(path, 60);
    expect(signed.error).not.toBeNull();
    const list = await bruno.client.storage.from("anexos").list(ana.id);
    expect(list.data ?? []).toEqual([]);
    const intrude = await bruno.client.storage.from("anexos").upload(`${ana.id}/intruso.txt`, new Blob(["x"], { type: "text/plain" }));
    expect(intrude.error).not.toBeNull();
    const remove = await bruno.client.storage.from("anexos").remove([path]);
    expect(remove.data ?? []).toEqual([]);
    const anon = await anonClient().storage.from("anexos").download(path);
    expect(anon.error).not.toBeNull();

    const own = await ana.client.storage.from("anexos").download(path);
    expect(own.error).toBeNull();
    expect(await own.data?.text()).toBe("segredo da Ana");
    await ana.client.storage.from("anexos").remove([path]);
  });
});
