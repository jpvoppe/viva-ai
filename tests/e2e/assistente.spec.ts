import { expect, test } from "@playwright/test";
import { adminClient, chatReady, createReadyUser, deleteTestUsers, hasTestDatabase, login, sendMessage, waitForAnswer, type TestUser } from "./helpers";
import { PLANS } from "../../src/lib/plans";

test.skip(!hasTestDatabase, "Requer Supabase de teste configurado.");
test.afterAll(async () => {
  await deleteTestUsers();
});

let user: TestUser;
test.beforeEach(async ({ page }) => {
  user = await createReadyUser("chat");
  await login(page, user);
});

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const messagesUsed = async (id: string) =>
  (await adminClient().from("usage_counters").select("count").eq("user_id", id).eq("kind", "mensagem").eq("period_start", today()).maybeSingle()).data?.count ?? 0;

test("conversa completa: pergunta, resposta transmitida, persistência e contagem de uso", async ({ page, isMobile }) => {
  await page.goto("/app/assistente");
  await expect(page.getByRole("heading", { name: "O que vamos resolver hoje?" })).toBeVisible();
  await expect(page.getByText("Modo de teste: as respostas da IA são simuladas.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar mensagem" })).toBeDisabled();

  await sendMessage(page, "Qual é a capital da França?");
  await waitForAnswer(page);
  await page.waitForURL(/\/app\/assistente\/[0-9a-f-]{36}$/);

  // Markdown renderizado: negrito, lista e bloco de código com botão de copiar.
  const answer = page.locator('[data-role="assistant"]').last();
  await expect(answer.locator("strong")).toHaveText("Resposta simulada");
  await expect(answer.locator("li")).toHaveCount(2);
  await expect(answer.getByRole("button", { name: "Copiar código" })).toBeVisible();
  await expect(page.locator('[data-role="user"]')).toContainText("Qual é a capital da França?");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Qual é a capital da França?");

  expect(await messagesUsed(user.id)).toBe(1);
  if (!isMobile) {
    await expect(page.getByText("1 de " + PLANS.gratuito.limits.dailyMessages)).toBeVisible();
    await expect(page.getByRole("complementary").getByRole("link", { name: "Qual é a capital da França?" })).toBeVisible();
  }

  // Recarregar traz a conversa do banco.
  await page.reload();
  await expect(page.locator('[data-role="user"]')).toContainText("Qual é a capital da França?");
  await expect(page.locator('[data-role="assistant"]')).toContainText("Resposta simulada");

  // Continuar a conversa mantém a mesma conversa.
  const url = page.url();
  await sendMessage(page, "E a da Itália?");
  await waitForAnswer(page);
  expect(page.url()).toBe(url);
  await expect(page.locator('[data-role="assistant"]')).toHaveCount(2);

  const { data: rows } = await adminClient().from("messages").select("role, status, model").eq("user_id", user.id).order("created_at");
  expect(rows?.map((r) => r.role)).toEqual(["user", "assistant", "user", "assistant"]);
  expect(rows?.every((r) => r.status === "completa")).toBe(true);
  const { data: usage } = await adminClient().from("usage_events").select("feature, status, input_tokens, output_tokens").eq("user_id", user.id);
  expect(usage).toHaveLength(2);
  expect(usage?.[0]).toMatchObject({ feature: "chat", status: "ok" });
  expect(usage?.[0].output_tokens).toBeGreaterThan(0);
});

test("Enter envia e Shift+Enter quebra a linha", async ({ page, isMobile }) => {
  test.skip(isMobile, "Teclado físico.");
  await page.goto("/app/assistente");
  const field = page.getByLabel("Mensagem para o VIVA");
  await field.fill("linha 1");
  await field.press("Shift+Enter");
  await field.pressSequentially("linha 2");
  await expect(field).toHaveValue("linha 1\nlinha 2");
  await field.press("Enter");
  await waitForAnswer(page);
  await expect(page.locator('[data-role="user"]')).toContainText("linha 1");
  await expect(field).toHaveValue("");
});

test("parar a geração guarda o trecho já recebido como interrompido", async ({ page }) => {
  await page.goto("/app/assistente");
  await sendMessage(page, "Escreva devagar [[lento]]");
  await expect(page.locator('[data-streaming="true"]')).toContainText("Resposta simulada", { timeout: 15_000 });
  await page.getByRole("button", { name: "Parar" }).click();
  await expect(page.getByText("Resposta interrompida.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar mensagem" })).toBeVisible();

  await expect
    .poll(async () => (await adminClient().from("messages").select("status").eq("user_id", user.id).eq("role", "assistant")).data?.[0]?.status, { timeout: 10_000 })
    .toBe("interrompida");
});

test("falha da IA: mensagem clara, cota devolvida e nova tentativa", async ({ page }) => {
  await page.goto("/app/assistente");
  await sendMessage(page, "Teste de falha [[erro-simulado]]");
  await expect(page.getByRole("alert").filter({ hasText: "O serviço de IA está sobrecarregado agora" })).toBeVisible();
  // A pergunta fica na tela, não aparece resposta inventada e a mensagem não é cobrada.
  await expect(page.locator('[data-role="user"]')).toContainText("Teste de falha");
  await expect(page.locator('[data-role="assistant"]')).toHaveCount(0);
  expect(await messagesUsed(user.id)).toBe(0);
  const { data: errors } = await adminClient().from("usage_events").select("status").eq("user_id", user.id);
  expect(errors?.[0]?.status).toBe("erro");

  await page.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "sobrecarregado" })).toBeVisible();
  expect(await messagesUsed(user.id)).toBe(0);
});

test("limite diário do plano é aplicado pelo servidor e explicado na tela", async ({ page }) => {
  const limit = PLANS.gratuito.limits.dailyMessages;
  await adminClient().from("usage_counters").insert({ user_id: user.id, kind: "mensagem", period_start: today(), count: limit });
  await page.goto("/app/assistente");
  await sendMessage(page, "Mais uma pergunta");
  await expect(page.getByText(`Você usou as ${limit} mensagens de hoje do plano Gratuito.`, { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Conhecer o VIVA Plus" })).toBeVisible();
  await expect(page.locator('[data-role="assistant"]')).toHaveCount(0);
  expect(await messagesUsed(user.id)).toBe(limit);
  // Chamada direta à API, sem passar pela tela, recebe a mesma recusa.
  const direct = await page.request.post("/api/chat", { data: { content: "tentativa direta" } });
  expect(direct.status()).toBe(429);
  expect((await direct.json()).error.code).toBe("limite_plano");
});

test("mensagem maior que o limite do plano é recusada com explicação", async ({ page }) => {
  await page.goto("/app/assistente");
  const big = "a".repeat(PLANS.gratuito.limits.maxInputChars + 10);
  await page.getByLabel("Mensagem para o VIVA").fill(big);
  await expect(page.getByText(/A mensagem passou do limite de/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar mensagem" })).toBeDisabled();
  const direct = await page.request.post("/api/chat", { data: { content: big } });
  expect(direct.status()).toBe(413);
  expect(await messagesUsed(user.id)).toBe(0);
});

test("gerar outra resposta, avaliar e copiar", async ({ page, context, isMobile }) => {
  test.skip(isMobile, "Área de transferência não disponível no perfil de celular.");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/app/assistente");
  await sendMessage(page, "Primeira pergunta");
  await waitForAnswer(page);

  await page.getByRole("button", { name: "Copiar resposta" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Resposta simulada");

  await page.getByRole("button", { name: "Resposta útil" }).click();
  await expect(page.getByRole("button", { name: "Resposta útil" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await adminClient().from("messages").select("feedback").eq("user_id", user.id).eq("role", "assistant")).data?.[0]?.feedback).toBe(1);

  await page.getByRole("button", { name: "Gerar outra resposta" }).click();
  await waitForAnswer(page);
  await expect(page.locator('[data-role="assistant"]')).toHaveCount(1);
  const { data: rows } = await adminClient().from("messages").select("role").eq("user_id", user.id);
  expect(rows).toHaveLength(2);
  expect(await messagesUsed(user.id)).toBe(2);
});

test("renomear e excluir a conversa, com confirmação", async ({ page }) => {
  await page.goto("/app/assistente");
  await sendMessage(page, "Conversa para renomear");
  await waitForAnswer(page);

  await page.getByRole("button", { name: "Opções da conversa" }).click();
  await page.getByRole("menuitem", { name: "Renomear conversa" }).click();
  await page.getByLabel("Nome da conversa").fill("");
  await page.getByRole("button", { name: "Salvar nome" }).click();
  await expect(page.getByLabel("Nome da conversa")).toBeFocused();
  await page.getByLabel("Nome da conversa").fill("Plano de férias");
  await page.getByRole("button", { name: "Salvar nome" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Plano de férias");

  await page.getByRole("button", { name: "Opções da conversa" }).click();
  await page.getByRole("menuitem", { name: "Excluir conversa" }).click();
  const dialog = page.getByRole("dialog", { name: "Excluir esta conversa?" });
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Plano de férias");

  await page.getByRole("button", { name: "Opções da conversa" }).click();
  await page.getByRole("menuitem", { name: "Excluir conversa" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir conversa" }).click();
  await page.waitForURL(/\/app\/assistente$/);
  const { data: rows } = await adminClient().from("conversations").select("id").eq("user_id", user.id);
  expect(rows).toEqual([]);
});

test("anexos: envio com validação real do conteúdo, uso na conversa e remoção", async ({ page }) => {
  await page.goto("/app/assistente");
  const input = page.locator('input[type="file"]');
  await chatReady(page);

  // Executável disfarçado de PDF é recusado pelo conteúdo.
  await input.setInputFiles("tests/fixtures/falso.pdf");
  await expect(page.getByText(/Tipo de arquivo não aceito/)).toBeVisible();
  await expect(page.getByText("Remova o arquivo com erro para enviar.")).toBeVisible();
  await page.getByRole("button", { name: "Remover falso.pdf" }).click();

  await input.setInputFiles(["tests/fixtures/nota.txt", "tests/fixtures/relatorio.pdf", "tests/fixtures/imagem.png"]);
  const list = page.getByRole("list", { name: "Arquivos anexados" });
  await expect(list.getByText("nota.txt")).toBeVisible();
  await expect(list.getByText("relatorio.pdf")).toBeVisible();
  await expect(list.getByText("imagem.png")).toBeVisible();
  await expect(list.getByText(/\d+ (B|KB)$/)).toHaveCount(3, { timeout: 20_000 });

  // Remover um anexo antes de enviar apaga o arquivo do servidor.
  await page.getByRole("button", { name: "Remover imagem.png" }).click();
  await expect(list.getByText("imagem.png")).toHaveCount(0);
  await expect.poll(async () => (await adminClient().from("files").select("id").eq("user_id", user.id)).data?.length).toBe(2);

  await sendMessage(page, "Resuma os arquivos");
  await waitForAnswer(page);
  const userMessage = page.locator('[data-role="user"]');
  await expect(userMessage.getByRole("link", { name: /nota\.txt/ })).toBeVisible();
  await expect(userMessage.getByRole("link", { name: /relatorio\.pdf/ })).toBeVisible();

  const admin = adminClient();
  const { data: files } = await admin.from("files").select("name, kind, extracted_text, storage_path").eq("user_id", user.id).order("name");
  expect(files?.map((f) => f.name)).toEqual(["nota.txt", "relatorio.pdf"]);
  expect(files?.[0].extracted_text).toContain("ABACAXI-42");
  expect(files?.[1].extracted_text).toContain("12345 reais");
  expect(files?.every((f) => f.storage_path.startsWith(`${user.id}/`))).toBe(true);
  const { data: links } = await admin.from("message_files").select("file_id").eq("user_id", user.id);
  expect(links).toHaveLength(2);

  // O anexo abre por link temporário para o dono.
  const href = await userMessage.getByRole("link", { name: /nota\.txt/ }).getAttribute("href");
  const own = await page.request.get(href!);
  expect(own.ok()).toBe(true);
  expect(await own.text()).toContain("ABACAXI-42");
});
