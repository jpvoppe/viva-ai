import { expect, test } from "@playwright/test";
import { adminClient, appReady, createReadyUser, deleteTestUsers, hasTestDatabase, login, sendMessage, waitForAnswer } from "./helpers";

test.skip(!hasTestDatabase, "Requer Supabase de teste configurado.");
test.afterAll(async () => {
  await deleteTestUsers();
});

/**
 * Navegação dentro do app (sem recarregar a página). O Next.js mantém as
 * últimas telas em memória; estes testes garantem que isso não mistura
 * conversas nem mostra dados velhos.
 */
test("“Nova conversa” sempre abre uma conversa vazia, e as anteriores continuam acessíveis", async ({ page, isMobile }) => {
  test.skip(isMobile, "Usa o menu lateral do computador.");
  const user = await createReadyUser("navegacao");
  await login(page, user);
  await appReady(page);
  const sidebar = page.getByRole("complementary", { name: "Menu principal" });

  await sidebar.getByRole("link", { name: "Nova conversa" }).click();
  await sendMessage(page, "Primeira conversa");
  await waitForAnswer(page);
  await page.waitForURL(/\/app\/assistente\/[0-9a-f-]{36}$/);
  const firstUrl = page.url();

  await sidebar.getByRole("link", { name: "Nova conversa" }).click();
  await page.waitForURL(/\/app\/assistente$/);
  await expect(page.getByRole("heading", { name: "O que vamos resolver hoje?" })).toBeVisible();
  await expect(page.locator('[data-role="user"]:visible')).toHaveCount(0);

  await sendMessage(page, "Segunda conversa");
  await waitForAnswer(page);
  await page.waitForURL(/\/app\/assistente\/[0-9a-f-]{36}$/);
  expect(page.url()).not.toBe(firstUrl);
  await expect(page.locator('[data-role="user"]:visible')).toHaveCount(1);
  await expect(page.locator('[data-role="user"]:visible')).toContainText("Segunda conversa");

  // Voltar para a primeira pelo menu lateral mostra só as mensagens dela.
  await sidebar.getByRole("link", { name: "Primeira conversa" }).click();
  await page.waitForURL(firstUrl);
  await expect(page.locator('[data-role="user"]:visible')).toHaveCount(1);
  await expect(page.locator('[data-role="user"]:visible')).toContainText("Primeira conversa");

  // Botão voltar do navegador também.
  await page.goBack();
  await expect(page.locator('[data-role="user"]:visible')).toContainText("Segunda conversa");

  const { data } = await adminClient().from("conversations").select("title").eq("user_id", user.id).order("created_at");
  expect(data?.map((c) => c.title)).toEqual(["Primeira conversa", "Segunda conversa"]);
});

test("mudanças feitas em uma tela aparecem nas outras ao navegar pelo menu", async ({ page, isMobile }) => {
  test.skip(isMobile, "Usa o menu lateral do computador.");
  const user = await createReadyUser("frescor");
  await login(page, user);
  await appReady(page);
  const sidebar = page.getByRole("complementary", { name: "Menu principal" });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

  // Visita o Início (vazio), cria tarefa no Organizador e volta ao Início.
  await expect(page.getByRole("region", { name: "Tarefas para hoje" })).toHaveCount(0);
  await sidebar.getByRole("link", { name: "Organizador" }).click();
  await page.getByRole("button", { name: "Criar tarefa com data, prioridade e repetição" }).click();
  const dialog = page.getByRole("dialog", { name: "Nova tarefa" });
  await dialog.getByLabel("O que precisa ser feito?").fill("Levar o carro à revisão");
  await dialog.getByLabel("Data").fill(today);
  await dialog.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(page.getByText("Tarefa criada.")).toBeVisible();

  await sidebar.getByRole("link", { name: "Início", exact: true }).click();
  const todayTasks = page.getByRole("region", { name: "Tarefas para hoje" });
  await expect(todayTasks.getByText("Levar o carro à revisão")).toBeVisible();

  // Conclui no Início e confere no Organizador.
  await todayTasks.getByRole("checkbox", { name: "Concluir tarefa: Levar o carro à revisão" }).click();
  await expect(page.getByText("Conquista desbloqueada")).toBeVisible();
  await sidebar.getByRole("link", { name: "Organizador" }).click();
  await expect(page.getByText("Tudo em dia.")).toBeVisible();
  await page.getByRole("button", { name: /Concluídas/ }).click();
  await expect(page.getByRole("checkbox", { name: "Reabrir tarefa: Levar o carro à revisão" })).toBeVisible();

  // Projeto criado aparece no Início.
  await sidebar.getByRole("link", { name: "Projetos" }).click();
  await page.getByRole("button", { name: "Criar o primeiro projeto" }).click();
  await page.getByLabel("Nome do projeto").fill("Horta no quintal");
  await page.getByRole("dialog").getByRole("button", { name: "Criar projeto" }).click();
  await page.waitForURL(/\/app\/projetos\/[0-9a-f-]{36}$/);
  await sidebar.getByRole("link", { name: "Início", exact: true }).click();
  await expect(page.getByRole("region", { name: "Projetos ativos" }).getByRole("link", { name: /Horta no quintal/ })).toBeVisible();
  await sidebar.getByRole("link", { name: "Projetos" }).click();
  await expect(page.getByRole("main").getByRole("link", { name: /Horta no quintal/ })).toBeVisible();
});
