import { expect, test } from "@playwright/test";
import { adminClient, createReadyUser, deleteTestUsers, hasTestDatabase, login, type TestUser } from "./helpers";
import { PLANS } from "../../src/lib/plans";

test.skip(!hasTestDatabase, "Requer Supabase de teste configurado.");
test.afterAll(async () => {
  await deleteTestUsers();
});

let user: TestUser;
test.beforeEach(async ({ page }) => {
  user = await createReadyUser("modulos");
  await login(page, user);
});

test("projeto: criar, sugerir etapas com IA, escolher, concluir etapa, ideias e conversa com contexto", async ({ page }) => {
  await page.goto("/app/projetos");
  await expect(page.getByRole("heading", { name: "Nenhum projeto ainda" })).toBeVisible();
  await page.getByRole("button", { name: "Criar o primeiro projeto" }).click();
  await page.getByLabel("Nome do projeto").fill("Reforma da cozinha");
  await page.getByLabel("Qual é o objetivo?").fill("Trocar armários e piso até dezembro");
  await page.getByRole("dialog").getByRole("button", { name: "Criar projeto" }).click();
  await page.waitForURL(/\/app\/projetos\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Reforma da cozinha" })).toBeVisible();
  await expect(page.getByText("sem etapas")).toBeVisible();

  // Sugestões da IA: a pessoa escolhe o que entra.
  await page.getByRole("button", { name: "Sugerir etapas com IA" }).click();
  const suggestions = page.getByRole("dialog", { name: "Etapas sugeridas pela IA" });
  await expect(suggestions.getByRole("checkbox")).toHaveCount(3);
  await suggestions.getByRole("checkbox").nth(2).uncheck();
  await suggestions.getByRole("button", { name: "Adicionar 2 etapas" }).click();
  await expect(page.getByText("Etapa simulada 1: definir o resultado esperado")).toBeVisible();
  await expect(page.getByText("Etapa simulada 3")).toHaveCount(0);
  await expect(page.getByText("0 de 2 etapas")).toBeVisible();

  // Etapa manual + concluir.
  await page.getByLabel("Adicionar etapa").fill("Escolher o piso");
  await page.getByRole("button", { name: "Adicionar etapa" }).click();
  await page.getByRole("checkbox", { name: "Concluir tarefa: Escolher o piso" }).click();
  await expect(page.getByText("1 de 3 etapas")).toBeVisible();

  // Ideias.
  await page.getByLabel("Nova ideia ou anotação").fill("Ver piso vinílico na loja do centro");
  await page.getByRole("button", { name: "Registrar ideia" }).click();
  await expect(page.getByText("Ver piso vinílico na loja do centro")).toBeVisible();

  // Conversa ligada ao projeto.
  await page.getByRole("link", { name: "Conversar sobre o projeto" }).click();
  await expect(page.getByRole("heading", { name: /Vamos avançar em “Reforma da cozinha”/ })).toBeVisible();
  await page.getByLabel("Mensagem para o VIVA").fill("Por onde começo?");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(page.locator('[data-role="assistant"]:not([data-streaming])')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("link", { name: "Projeto: Reforma da cozinha" })).toBeVisible();

  const admin = adminClient();
  const { data: project } = await admin.from("projects").select("id").eq("user_id", user.id).single();
  const { data: conversation } = await admin.from("conversations").select("project_id").eq("user_id", user.id).single();
  expect(conversation?.project_id).toBe(project?.id);

  // Concluir o projeto.
  await page.goto(`/app/projetos/${project!.id}`);
  await expect(page.getByRole("region", { name: "Conversas do projeto" }).getByRole("link", { name: "Por onde começo?" })).toBeVisible();
  await page.getByRole("button", { name: "Opções do projeto" }).click();
  await page.getByRole("menuitem", { name: "Marcar projeto como concluído" }).click();
  await expect(page.getByText("Concluído", { exact: true })).toBeVisible();
  const { data: done } = await admin.from("projects").select("status, completed_at").eq("id", project!.id).single();
  expect(done?.status).toBe("concluido");
  expect(done?.completed_at).not.toBeNull();
});

test("limite de projetos ativos do plano gratuito é aplicado no servidor", async ({ page }) => {
  const max = PLANS.gratuito.limits.maxActiveProjects;
  await adminClient().from("projects").insert(Array.from({ length: max }, (_, i) => ({ user_id: user.id, name: `Projeto ${i + 1}` })));
  await page.goto("/app/projetos?novo=1");
  const dialog = page.getByRole("dialog", { name: "Novo projeto" });
  await dialog.getByLabel("Nome do projeto").fill("Mais um");
  await dialog.getByRole("button", { name: "Criar projeto" }).click();
  await expect(dialog.getByText(`O plano Gratuito permite ${max} projetos ativos.`, { exact: false })).toBeVisible();
  expect((await adminClient().from("projects").select("id").eq("user_id", user.id)).data).toHaveLength(max);
});

test("ferramenta de criação: gerar, salvar, editar, baixar e virar lista", async ({ page }) => {
  await page.goto("/app/criar");
  await page.getByRole("link", { name: /Organizar compras/ }).click();
  await page.waitForURL(/\/app\/criar\/compras$/);

  // Campo obrigatório validado antes de gastar uma criação.
  await page.getByRole("button", { name: "Organizar lista" }).click();
  await expect(page.getByText("Preencha este campo.")).toBeVisible();

  await page.getByLabel("O que você precisa comprar?").fill("arroz, tomate, sabão em pó");
  await page.getByRole("button", { name: "Organizar lista" }).click();
  const result = page.getByRole("region", { name: "Resultado" });
  await expect(result.getByRole("button", { name: "Salvar nas criações" })).toBeVisible({ timeout: 20_000 });
  await expect(result).toContainText("Resposta simulada");
  await expect(page.getByText(`${PLANS.gratuito.limits.dailyGenerations - 1} de ${PLANS.gratuito.limits.dailyGenerations} criações disponíveis hoje.`)).toBeVisible();

  // Download real de arquivo.
  await result.getByRole("button", { name: "Baixar arquivo" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Texto simples (.txt)" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.txt$/);

  // Vira lista no Organizador.
  await result.getByRole("button", { name: "Criar lista no Organizador" }).click();
  await expect(result.getByRole("link", { name: /Lista criada/ })).toBeVisible();
  const { data: lists } = await adminClient().from("lists").select("kind, list_items(text)").eq("user_id", user.id);
  expect(lists).toHaveLength(1);
  expect(lists?.[0].kind).toBe("compras");
  expect(lists?.[0].list_items.length).toBeGreaterThan(0);

  // Salvar e editar.
  await result.getByRole("button", { name: "Salvar nas criações" }).click();
  await result.getByRole("link", { name: /Salvo/ }).click();
  await page.waitForURL(/\/app\/criar\/documento\//);
  await page.getByRole("button", { name: "Editar texto" }).click();
  await page.getByLabel("Texto (aceita Markdown)").fill("# Minha lista\n\n- arroz");
  await expect(page.getByText("Há alterações não salvas")).toBeVisible();
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Há alterações não salvas")).toHaveCount(0);
  await page.getByRole("button", { name: "Ver resultado" }).click();
  await expect(page.getByRole("article").getByRole("heading", { name: "Minha lista" })).toBeVisible();

  await page.goto("/app/criar");
  await expect(page.getByRole("region", { name: "Suas criações" }).getByRole("link")).toHaveCount(1);
  const { data: usage } = await adminClient().from("usage_events").select("feature").eq("user_id", user.id);
  expect(usage?.[0].feature).toBe("ferramenta:compras");
});

test("conversor de unidades calcula sem IA e sem gastar criações", async ({ page }) => {
  await page.goto("/app/criar/conversor");
  await page.getByLabel("O que você quer converter?").selectOption("temperatura");
  await page.getByLabel("Valor").fill("100");
  await page.getByLabel("De", { exact: true }).selectOption("c");
  await page.getByLabel("Para").selectOption("f");
  await expect(page.getByRole("status").filter({ hasText: "Resultado" })).toContainText("212");
  await page.getByRole("button", { name: "Inverter as unidades" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Resultado" })).toContainText("37,777");
  await page.getByLabel("Valor").fill("abc");
  await expect(page.getByText("Digite um número, por exemplo 2,5.")).toBeVisible();
  expect((await adminClient().from("usage_events").select("id").eq("user_id", user.id)).data).toEqual([]);
});

test("cartões de estudo: gerar com IA, revisar com repetição espaçada e editar", async ({ page }) => {
  await page.goto("/app/aprender");
  await page.getByRole("button", { name: "Criar cartões com IA" }).click();
  await page.getByLabel("Assunto ou texto-base").fill("Fotossíntese");
  await page.getByRole("dialog").getByRole("button", { name: "Criar cartões" }).click();
  await page.waitForURL(/\/app\/aprender\/baralho\//, { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Fotossíntese" })).toBeVisible();
  await expect(page.getByText("3 cartões, 3 para revisar agora")).toBeVisible();

  await page.getByRole("button", { name: "Revisar 3 cartões" }).click();
  for (const correct of [true, false, true]) {
    await page.getByRole("button", { name: "Ver resposta" }).click();
    await page.getByRole("button", { name: correct ? "Acertei" : "Errei", exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "Revisão concluída" })).toBeVisible();
  await expect(page.getByText("Você acertou 2 de 3.")).toBeVisible();

  const { data: cards } = await adminClient().from("flashcards").select("box, review_count, due_at").eq("user_id", user.id).order("created_at");
  expect(cards?.map((c) => c.box)).toEqual([2, 1, 2]);
  expect(cards?.every((c) => c.review_count === 1)).toBe(true);
  expect(new Date(cards![0].due_at).getTime()).toBeGreaterThan(Date.now() + 86_400_000);
  expect(new Date(cards![1].due_at).getTime()).toBeLessThan(Date.now() + 3_600_000);

  await page.getByRole("button", { name: "Voltar ao baralho" }).click();
  await page.getByRole("button", { name: "Adicionar cartão" }).click();
  await page.getByLabel("Pergunta (frente)").fill("O que é clorofila?");
  await page.getByLabel("Resposta (verso)").fill("O pigmento verde das plantas.");
  await page.getByRole("button", { name: "Salvar cartão" }).click();
  await expect(page.getByText("O que é clorofila?")).toBeVisible();
});

test("questionário: responder, ver explicação e nota calculada no servidor", async ({ page }) => {
  await page.goto("/app/aprender");
  await page.getByRole("button", { name: "Criar questionário com IA" }).click();
  await page.getByLabel("Assunto ou texto-base").fill("Sistema solar");
  await page.getByRole("dialog").getByRole("button", { name: "Criar questionário" }).click();
  await page.waitForURL(/\/app\/aprender\/quiz\//, { timeout: 20_000 });

  // Pergunta 1: a correta é a opção B (índice 1). Erra de propósito.
  await expect(page.getByRole("button", { name: "Conferir resposta" })).toBeDisabled();
  await page.getByRole("radio", { name: "Opção A" }).check();
  await page.getByRole("button", { name: "Conferir resposta" }).click();
  await expect(page.getByText("Não foi desta vez.")).toBeVisible();
  await expect(page.getByText("Explicação simulada: a opção B é a correta neste teste.")).toBeVisible();
  await page.getByRole("button", { name: "Próxima pergunta" }).click();
  // Pergunta 2: a correta é a opção A.
  await page.getByRole("radio", { name: "Opção A" }).check();
  await page.getByRole("button", { name: "Conferir resposta" }).click();
  await expect(page.getByText("Você acertou.")).toBeVisible();
  await page.getByRole("button", { name: "Ver resultado" }).click();
  await expect(page.getByRole("heading", { name: "Você acertou 1 de 2" })).toBeVisible();

  const { data: attempts } = await adminClient().from("quiz_attempts").select("score, total, answers").eq("user_id", user.id);
  expect(attempts).toEqual([{ score: 1, total: 2, answers: [0, 0] }]);
});

test("histórico: lista, busca pelo conteúdo, renomeia e exclui", async ({ page }) => {
  const admin = adminClient();
  const { data: a } = await admin.from("conversations").insert({ user_id: user.id, title: "Receita de bolo" }).select("id").single();
  await admin.from("messages").insert({ conversation_id: a!.id, user_id: user.id, role: "user", content: "Como fazer bolo de cenoura com cobertura?" });
  const { data: b } = await admin.from("conversations").insert({ user_id: user.id, title: "Viagem a Salvador" }).select("id").single();
  await admin.from("messages").insert({ conversation_id: b!.id, user_id: user.id, role: "user", content: "Roteiro de 3 dias" });

  await page.goto("/app/historico");
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: /Receita de bolo/ })).toBeVisible();
  await expect(main.getByRole("link", { name: /Viagem a Salvador/ })).toBeVisible();

  const search = page.getByLabel("Buscar nas conversas");
  await search.fill("cenoura");
  await expect(page.getByRole("region", { name: "Resultados" }).getByRole("link")).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Resultados" }).locator("mark")).toHaveText(/cenoura/i);
  await search.fill("salvador");
  await expect(page.getByRole("region", { name: "Resultados" }).getByRole("link", { name: /Viagem a Salvador/ })).toBeVisible();
  await search.fill("xyzinexistente");
  await expect(page.getByRole("heading", { name: "Nada encontrado" })).toBeVisible();
  await page.getByRole("button", { name: "Limpar busca" }).click();

  await page.getByRole("button", { name: "Opções da conversa: Receita de bolo" }).click();
  await page.getByRole("menuitem", { name: "Renomear conversa" }).click();
  await page.getByLabel("Nome da conversa").fill("Bolo de cenoura");
  await page.getByRole("button", { name: "Salvar nome" }).click();
  await expect(main.getByRole("link", { name: /Bolo de cenoura/ })).toBeVisible();
  // O menu lateral acompanha o novo nome, sem recarregar.
  await expect(page.getByRole("complementary").getByRole("link", { name: "Bolo de cenoura" })).toBeVisible();

  await page.getByRole("button", { name: "Opções da conversa: Viagem a Salvador" }).click();
  await page.getByRole("menuitem", { name: "Excluir conversa" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir conversa" }).click();
  await expect(page.getByText("Conversa excluída.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Viagem a Salvador/ })).toHaveCount(0);
  const { data: left } = await admin.from("conversations").select("title").eq("user_id", user.id);
  expect(left).toEqual([{ title: "Bolo de cenoura" }]);
});

test("tela inicial mostra só dados reais: tarefas de hoje, projetos e conversas", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByRole("region", { name: "Tarefas para hoje" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Projetos ativos" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Sua semana" })).toHaveCount(0);

  const admin = adminClient();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  await admin.from("tasks").insert([
    { user_id: user.id, title: "Ligar para o banco", due_date: today },
    { user_id: user.id, title: "Tarefa de amanhã", due_date: "2099-01-01" },
  ]);
  await admin.from("projects").insert({ user_id: user.id, name: "Mudança" });
  await page.reload();
  const todayTasks = page.getByRole("region", { name: "Tarefas para hoje" });
  await expect(todayTasks.getByText("Ligar para o banco")).toBeVisible();
  await expect(todayTasks.getByText("Tarefa de amanhã")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Projetos ativos" }).getByRole("link", { name: /Mudança/ })).toBeVisible();

  await todayTasks.getByRole("checkbox", { name: "Concluir tarefa: Ligar para o banco" }).click();
  await expect(page.getByText("Conquista desbloqueada")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "Sua semana" })).toContainText("1 de 7");

  // O campo de comando abre uma conversa com o texto digitado.
  await page.getByLabel("Escreva o que você precisa").fill("Me ajude com um orçamento");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await page.waitForURL(/\/app\/assistente\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  await expect(page.locator('[data-role="user"]')).toContainText("Me ajude com um orçamento");
});
