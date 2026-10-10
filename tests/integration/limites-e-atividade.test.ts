import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createTestUser, deleteTestUsers, hasTestDatabase, type TestUser } from "../helpers/supabase";

describe.skipIf(!hasTestDatabase)("cotas, limite de requisições e atividade", () => {
  const admin = adminClient();
  let user: TestUser;

  beforeAll(async () => {
    user = await createTestUser("limites");
  });
  afterAll(async () => {
    await deleteTestUsers();
  });

  it("novo usuário nasce com perfil, preferências seguras e plano gratuito", async () => {
    const { data } = await user.client.rpc("my_context");
    expect(data.profile).toMatchObject({ display_name: "limites", age_band: "adulto", role: "user", locale: "pt-BR" });
    expect(data.profile.terms_accepted_at).not.toBeNull();
    expect(data.preferences).toMatchObject({ memory_enabled: false, theme: "sistema", response_style: "equilibrado" });
    expect(data.plan).toBe("gratuito");
    expect(data.subscription).toMatchObject({ plan: "gratuito", status: "active", has_customer: false });
  });

  it("metadados maliciosos no cadastro não viram administrador nem faixa etária inválida", async () => {
    const sneaky = await createTestUser("espertinho", { display_name: "x".repeat(300), age_band: "admin", role: "admin", timezone: "Fuso/Falso" });
    const { data } = await sneaky.client.rpc("my_context");
    expect(data.profile.role).toBe("user");
    expect(data.profile.age_band).toBeNull();
    expect(data.profile.display_name).toHaveLength(80);
    expect(data.profile.timezone).toBe("America/Sao_Paulo");
  });

  it("a cota nunca passa do limite, mesmo com 20 chamadas simultâneas", async () => {
    const period = "2026-01-15";
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        admin.rpc("consume_quota", { p_user: user.id, p_kind: "mensagem", p_period: period, p_limit: 5 }),
      ),
    );
    const allowed = results.filter((r) => r.data?.[0]?.allowed === true).length;
    expect(allowed).toBe(5);
    const { data } = await admin.from("usage_counters").select("count").eq("user_id", user.id).eq("period_start", period).single();
    expect(data?.count).toBe(5);
  });

  it("devolver a cota libera uma unidade e nunca fica negativa", async () => {
    const period = "2026-01-16";
    await admin.rpc("consume_quota", { p_user: user.id, p_kind: "geracao", p_period: period, p_limit: 1 });
    const blocked = await admin.rpc("consume_quota", { p_user: user.id, p_kind: "geracao", p_period: period, p_limit: 1 });
    expect(blocked.data[0]).toMatchObject({ allowed: false, used: 1 });
    await admin.rpc("refund_quota", { p_user: user.id, p_kind: "geracao", p_period: period });
    await admin.rpc("refund_quota", { p_user: user.id, p_kind: "geracao", p_period: period });
    const again = await admin.rpc("consume_quota", { p_user: user.id, p_kind: "geracao", p_period: period, p_limit: 1 });
    expect(again.data[0]).toMatchObject({ allowed: true, used: 1 });
  });

  it("limite zero bloqueia tudo; dias diferentes têm contagens separadas", async () => {
    const zero = await admin.rpc("consume_quota", { p_user: user.id, p_kind: "arquivo", p_period: "2026-01-17", p_limit: 0 });
    expect(zero.data[0].allowed).toBe(false);
    const day1 = await admin.rpc("consume_quota", { p_user: user.id, p_kind: "arquivo", p_period: "2026-01-18", p_limit: 1 });
    const day2 = await admin.rpc("consume_quota", { p_user: user.id, p_kind: "arquivo", p_period: "2026-01-19", p_limit: 1 });
    expect(day1.data[0].allowed && day2.data[0].allowed).toBe(true);
  });

  it("o limite de requisições libera até o máximo da janela e depois recusa", async () => {
    const key = `teste:${Date.now()}`;
    const results: boolean[] = [];
    for (let i = 0; i < 5; i++) {
      const { data } = await admin.rpc("rate_limit_hit", { p_key: key, p_window_seconds: 3600, p_max: 3 });
      results.push(data);
    }
    expect(results).toEqual([true, true, true, false, false]);
  });

  it("concluir e reabrir a mesma tarefa conta uma vez só (sem inflar o progresso)", async () => {
    const { data: task } = await user.client.from("tasks").insert({ title: "tarefa de teste" }).select("id").single();
    const complete = () => user.client.from("tasks").update({ completed_at: new Date().toISOString() }).eq("id", task!.id);
    const reopen = () => user.client.from("tasks").update({ completed_at: null }).eq("id", task!.id);
    const count = async () => {
      const { data } = await user.client.from("activity_events").select("id").eq("kind", "tarefa_concluida");
      return data?.length ?? 0;
    };
    await complete();
    expect(await count()).toBe(1);
    await reopen();
    expect(await count()).toBe(0);
    await complete();
    await reopen();
    await complete();
    expect(await count()).toBe(1);
  });

  it("estatísticas e conquistas saem só de eventos registrados", async () => {
    const before = await user.client.rpc("my_stats");
    expect(before.data.totais.tarefa_concluida).toBe(1);
    expect(before.data.dias_ativos_semana).toBe(1);
    expect(before.data.sequencia_atual).toBe(1);

    const first = await user.client.rpc("sync_achievements");
    expect(first.data).toContain("primeira_tarefa");
    expect(first.data).not.toContain("dez_tarefas");
    expect(first.data).not.toContain("primeira_conversa");
    // Chamar de novo não desbloqueia a mesma conquista duas vezes.
    const second = await user.client.rpc("sync_achievements");
    expect(second.data).toEqual([]);

    // O usuário não consegue fabricar eventos nem conquistas direto no banco.
    const fakeEvent = await user.client.from("activity_events").insert({ user_id: user.id, kind: "tarefa_concluida", day: "2026-01-01" });
    expect(fakeEvent.error).not.toBeNull();
    const fakeAchievement = await user.client.from("user_achievements").insert({ user_id: user.id, code: "sequencia_7" });
    expect(fakeAchievement.error).not.toBeNull();
  });

  it("um dia de descanso não quebra a sequência; dois dias, sim", async () => {
    const streakUser = await createTestUser("sequencia");
    const today = new Date();
    const day = (offset: number) => new Date(today.getTime() - offset * 86_400_000).toISOString().slice(0, 10);
    const { data: ctx } = await streakUser.client.rpc("my_stats");
    const base = new Date(`${ctx.hoje}T12:00:00Z`);
    const iso = (offset: number) => new Date(base.getTime() - offset * 86_400_000).toISOString().slice(0, 10);
    void day;
    // hoje, 2 dias atrás (1 de descanso), 3 dias atrás; depois um buraco de 3 dias; e mais 2 dias antigos
    for (const offset of [0, 2, 3, 7, 8]) {
      await admin.from("activity_events").insert({ user_id: streakUser.id, kind: "mensagem_enviada", day: iso(offset) });
    }
    const { data } = await streakUser.client.rpc("my_stats");
    expect(data.sequencia_atual).toBe(3);
    expect(data.melhor_sequencia).toBe(3);
  });

  it("plano efetivo: assinatura própria, família ativa e família com assinatura encerrada", async () => {
    const owner = await createTestUser("responsavel");
    const member = await createTestUser("membro");
    await admin.from("subscriptions").update({ plan: "familia", status: "active" }).eq("user_id", owner.id);
    const { data: family } = await admin.from("families").insert({ owner_id: owner.id }).select("id").single();
    await admin.from("family_members").insert({ family_id: family!.id, user_id: member.id });

    expect((await owner.client.rpc("my_plan")).data).toBe("familia");
    expect((await member.client.rpc("my_plan")).data).toBe("familia");

    // O membro vê quem está na família (só nomes), mas nenhum dado do responsável.
    const roster = await member.client.rpc("family_roster");
    expect(roster.data).toHaveLength(2);
    expect(Object.keys(roster.data[0]).sort()).toEqual(["display_name", "is_owner", "joined_at", "user_id"]);
    await owner.client.from("projects").insert({ name: "Projeto do responsável" });
    expect((await member.client.from("projects").select("id")).data).toEqual([]);
    // E quem não é da família não vê nada dela.
    expect((await user.client.rpc("family_roster")).data).toEqual([]);
    expect((await user.client.from("families").select("id")).data).toEqual([]);
    expect((await member.client.from("family_invites").select("id")).data).toEqual([]);

    await admin.from("subscriptions").update({ plan: "gratuito", status: "active" }).eq("user_id", owner.id);
    expect((await member.client.rpc("my_plan")).data).toBe("gratuito");

    await admin.from("subscriptions").update({ plan: "plus", status: "canceled" }).eq("user_id", owner.id);
    expect((await owner.client.rpc("my_plan")).data).toBe("gratuito");
    await admin.from("subscriptions").update({ plan: "plus", status: "past_due" }).eq("user_id", owner.id);
    expect((await owner.client.rpc("my_plan")).data).toBe("plus");
  });

  it("excluir a conta apaga tudo que pertence ao usuário", async () => {
    const leaving = await createTestUser("saindo");
    const { data: project } = await leaving.client.from("projects").insert({ name: "p" }).select("id").single();
    await leaving.client.from("tasks").insert({ title: "t", project_id: project!.id });
    const { data: conversation } = await leaving.client.from("conversations").insert({ title: "c" }).select("id").single();
    await leaving.client.from("messages").insert({ conversation_id: conversation!.id, role: "user", content: "m" });
    await leaving.client.from("memories").insert({ content: "lembrar" });
    await admin.from("usage_events").insert({ user_id: leaving.id, feature: "chat", provider: "x", model: "y", input_tokens: 1, output_tokens: 1 });

    const { error } = await admin.auth.admin.deleteUser(leaving.id);
    expect(error).toBeNull();

    for (const table of ["profiles", "user_preferences", "subscriptions"]) {
      const column = table === "profiles" ? "id" : "user_id";
      const { data } = await admin.from(table).select(column).eq(column, leaving.id);
      expect(data, table).toEqual([]);
    }
    for (const table of ["projects", "tasks", "conversations", "messages", "memories", "activity_events", "usage_counters"]) {
      const { data } = await admin.from(table).select("user_id").eq("user_id", leaving.id);
      expect(data, table).toEqual([]);
    }
    // O registro de consumo fica, mas sem vínculo com a pessoa.
    const { data: usage } = await admin.from("usage_events").select("user_id").eq("feature", "chat").eq("model", "y").is("user_id", null);
    expect(usage?.length).toBeGreaterThanOrEqual(1);
  });
});
