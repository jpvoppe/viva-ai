import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { adminClient, chatReady, createReadyUser, deleteTestUsers, hasTestDatabase, login, sendMessage, waitForAnswer, type TestUser } from "./helpers";

test.skip(!hasTestDatabase, "Requer Supabase de teste configurado.");
test.afterAll(async () => {
  await deleteTestUsers();
});

let user: TestUser;
test.beforeEach(async ({ page }) => {
  user = await createReadyUser("config");
  await login(page, user);
});

test("tema claro/escuro troca na hora, sem piscar ao recarregar, e fica salvo", async ({ page }) => {
  await page.goto("/app/configuracoes?aba=preferencias");
  await page.getByRole("radio", { name: "Escuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(21, 19, 28)");
  await expect.poll(async () => (await adminClient().from("user_preferences").select("theme").eq("user_id", user.id).single()).data?.theme).toBe("escuro");

  // Ao recarregar, o tema já vem aplicado antes de o app montar.
  await page.reload({ waitUntil: "commit" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("radio", { name: "Claro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("preferências de conversa: estilo de resposta e tecla Enter", async ({ page }) => {
  await page.goto("/app/configuracoes?aba=preferencias");
  await page.getByRole("radio", { name: /Detalhado/ }).click();
  await page.getByRole("switch", { name: "Enter envia a mensagem" }).click();
  await expect.poll(async () => (await adminClient().from("user_preferences").select("response_style, enter_to_send").eq("user_id", user.id).single()).data).toEqual({
    response_style: "detalhado",
    enter_to_send: false,
  });

  await page.goto("/app/assistente");
  const field = page.getByLabel("Mensagem para o VIVA");
  await field.fill("primeira linha");
  await field.press("Enter");
  await field.pressSequentially("segunda linha");
  await expect(field).toHaveValue("primeira linha\nsegunda linha");
  await field.press("Control+Enter");
  await waitForAnswer(page);
});

test("nome de tratamento pode ser alterado; validação impede nome vazio", async ({ page }) => {
  await page.goto("/app/configuracoes");
  await page.getByLabel("Como quer ser chamado?").fill("A");
  await page.getByRole("button", { name: "Salvar nome" }).click();
  await expect(page.getByText("Informe como quer ser chamado.")).toBeVisible();
  await page.getByLabel("Como quer ser chamado?").fill("Carolina");
  await page.getByRole("button", { name: "Salvar nome" }).click();
  await expect(page.getByText("Nome atualizado.")).toBeVisible();
  await page.goto("/app");
  await expect(page.getByText(/, Carolina\./)).toBeVisible();
});

test("memória: consentimento, itens, bloqueio de dado sensível, uso na conversa e exclusão", async ({ page }) => {
  await page.goto("/app/configuracoes?aba=memoria");
  await expect(page.getByText("A memória está desligada.")).toBeVisible();
  await expect(page.getByLabel("Adicionar um item")).toHaveCount(0);

  await page.getByRole("switch", { name: "Usar a memória nas respostas" }).click();
  await expect(page.getByText("Memória ativada.")).toBeVisible();
  const { data: prefs } = await adminClient().from("user_preferences").select("memory_enabled, memory_consent_at").eq("user_id", user.id).single();
  expect(prefs?.memory_enabled).toBe(true);
  expect(prefs?.memory_consent_at).not.toBeNull();

  const add = page.getByLabel("Adicionar um item");
  await add.fill("Meu CPF é 123.456.789-09");
  await page.getByRole("button", { name: "Guardar na memória" }).click();
  await expect(page.getByText(/parece um dado sensível/)).toBeVisible();

  await add.fill("Prefiro respostas em tópicos");
  await page.getByRole("button", { name: "Guardar na memória" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Prefiro respostas em tópicos" })).toBeVisible();
  expect((await adminClient().from("memories").select("content").eq("user_id", user.id)).data).toEqual([{ content: "Prefiro respostas em tópicos" }]);

  // Na conversa, dá para guardar uma mensagem na memória (com revisão antes).
  await page.goto("/app/assistente");
  await sendMessage(page, "Estou estudando para o ENEM");
  await waitForAnswer(page);
  await page.locator('[data-role="user"]').hover();
  await page.getByRole("button", { name: "Guardar na memória" }).click();
  const dialog = page.getByRole("dialog", { name: "Guardar na memória" });
  await expect(dialog.getByLabel("O que o VIVA deve lembrar")).toHaveValue("Estou estudando para o ENEM");
  await dialog.getByRole("button", { name: "Guardar na memória" }).click();
  await expect(dialog).toBeHidden();

  await page.goto("/app/configuracoes?aba=memoria");
  await expect(page.getByRole("heading", { name: /O que o VIVA lembra \(2 de/ })).toBeVisible();
  await page.getByRole("button", { name: "Apagar: Prefiro respostas em tópicos" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Prefiro respostas em tópicos" })).toHaveCount(0);
  await page.getByRole("button", { name: "Apagar toda a memória" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Apagar toda a memória" }).click();
  await expect(page.getByRole("heading", { name: "Nada guardado" })).toBeVisible();
  expect((await adminClient().from("memories").select("id").eq("user_id", user.id)).data).toEqual([]);
});

test("progresso mostra só o que foi registrado e pode ser desligado", async ({ page }) => {
  await page.goto("/app/configuracoes?aba=progresso");
  await expect(page.getByRole("heading", { name: /Conquistas \(0 de/ })).toBeVisible();
  await expect(page.getByText("Ainda não desbloqueada").first()).toBeVisible();

  await page.goto("/app/configuracoes?aba=preferencias");
  await page.getByLabel("Meta de tarefas por semana").fill("500");
  await page.getByRole("button", { name: "Salvar meta" }).click();
  await expect(page.getByText("Use um número inteiro de 1 a 100, ou deixe vazio.")).toBeVisible();
  await page.getByLabel("Meta de tarefas por semana").fill("5");
  await page.getByRole("button", { name: "Salvar meta" }).click();
  await expect(page.getByText("Meta semanal salva.")).toBeVisible();

  await page.getByRole("switch", { name: "Mostrar progresso, sequências e conquistas" }).click();
  await expect.poll(async () => (await adminClient().from("user_preferences").select("gamification_enabled").eq("user_id", user.id).single()).data?.gamification_enabled).toBe(false);
  await page.goto("/app/configuracoes?aba=progresso");
  await expect(page.getByRole("heading", { name: "Progresso desligado" })).toBeVisible();
});

test("assinatura: sem pagamentos configurados, nada é cobrado e os botões ficam desativados", async ({ page }) => {
  await page.goto("/app/configuracoes?aba=assinatura");
  await expect(page.getByText("Gratuito").first()).toBeVisible();
  await expect(page.getByText("As assinaturas ainda não foram ativadas neste ambiente.")).toBeVisible();
  await expect(page.getByText("Preço a definir").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Assinar VIVA Plus" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Gerenciar assinatura" })).toHaveCount(0);
  await expect(page.getByRole("progressbar", { name: "Mensagens ao assistente" })).toBeVisible();
});

test("plano Família: responsável convida, convidado aceita com o e-mail certo, dados continuam privados", async ({ page, browser }) => {
  const admin = adminClient();
  await admin.from("subscriptions").update({ plan: "familia", status: "active" }).eq("user_id", user.id);
  await admin.from("families").insert({ owner_id: user.id });
  await admin.from("projects").insert({ user_id: user.id, name: "Projeto particular do responsável" });
  const guest = await createReadyUser("convidado");
  const stranger = await createReadyUser("estranho");

  await page.goto("/app/configuracoes?aba=assinatura");
  await expect(page.getByRole("heading", { name: "Família (1 de 5 lugares)" })).toBeVisible();
  await page.getByLabel("Convidar por e-mail").fill(guest.email);
  await page.getByRole("button", { name: "Criar convite" }).click();
  const link = await page.locator("span.font-mono").innerText();
  expect(link).toMatch(/\/app\/convite\/[\w-]{40,}$/);
  await expect(page.getByText("Convite aguardando aceite")).toBeVisible();
  // O código do convite não fica guardado em texto puro.
  const token = link.split("/").pop()!;
  const { data: stored } = await admin.from("family_invites").select("token_hash").single();
  expect(stored?.token_hash).not.toContain(token);

  // Outra pessoa com o link não consegue usar o convite.
  const strangerContext = await browser.newContext();
  const strangerPage = await strangerContext.newPage();
  await login(strangerPage, stranger);
  await strangerPage.goto(new URL(link).pathname);
  await strangerPage.getByRole("button", { name: "Aceitar convite" }).click();
  await expect(strangerPage.getByText("Este convite foi enviado para outro e-mail.", { exact: false })).toBeVisible();
  await strangerContext.close();

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await login(guestPage, guest);
  await guestPage.goto(new URL(link).pathname);
  await guestPage.getByRole("button", { name: "Aceitar convite" }).click();
  await expect(guestPage.getByText("Você entrou no plano Família.")).toBeVisible();
  expect((await guest.client.rpc("my_plan")).data).toBe("familia");
  // O convite não pode ser usado de novo.
  await guestPage.reload();
  await guestPage.getByRole("button", { name: "Aceitar convite" }).click();
  await expect(guestPage.getByText(/não é válido, expirou ou já foi usado/)).toBeVisible();
  // O convidado não vê nada do responsável.
  await guestPage.goto("/app/projetos");
  await expect(guestPage.getByRole("heading", { name: "Nenhum projeto ainda" })).toBeVisible();
  await guestPage.goto("/app/configuracoes?aba=assinatura");
  await expect(guestPage.getByText("Pelo plano Família de outra pessoa")).toBeVisible();
  await guestContext.close();

  // O responsável remove o membro; ele volta ao gratuito.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Família (2 de 5 lugares)" })).toBeVisible();
  await page.getByRole("button", { name: "Remover da família" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remover da família" }).click();
  await expect(page.getByText("Pessoa removida da família.")).toBeVisible();
  expect((await guest.client.rpc("my_plan")).data).toBe("gratuito");
});

test("baixar meus dados traz o que é meu e nada de outra conta", async ({ page }) => {
  const admin = adminClient();
  const other = await createReadyUser("outro");
  await admin.from("projects").insert([
    { user_id: user.id, name: "Meu projeto exportável" },
    { user_id: other.id, name: "Projeto alheio secreto" },
  ]);
  await page.goto("/app/configuracoes?aba=privacidade");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Baixar meus dados" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^viva-meus-dados-\d{4}-\d{2}-\d{2}\.json$/);
  const content = readFileSync(await file.path(), "utf8");
  const json = JSON.parse(content);
  expect(json.conta.email).toBe(user.email);
  expect(json.dados.projects.map((p: { name: string }) => p.name)).toEqual(["Meu projeto exportável"]);
  expect(content).not.toContain("Projeto alheio secreto");
  expect(content).not.toContain(other.email);
  expect(json.dados.profiles[0].display_name).toBe("config");
});

test("excluir a conta apaga tudo e impede novo login", async ({ page }) => {
  const admin = adminClient();
  await admin.from("projects").insert({ user_id: user.id, name: "Vai sumir" });
  await page.goto("/app/assistente");
  await chatReady(page);
  await page.locator('input[type="file"]').setInputFiles("tests/fixtures/nota.txt");
  // Espera o envio terminar: o item passa a mostrar o tamanho do arquivo.
  await expect(page.getByRole("list", { name: "Arquivos anexados" }).getByText(/\d+ B$/)).toBeVisible({ timeout: 20_000 });
  await sendMessage(page, "Guarde este arquivo");
  await waitForAnswer(page);
  const { data: files } = await admin.from("files").select("storage_path").eq("user_id", user.id);
  expect(files).toHaveLength(1);

  await page.goto("/app/configuracoes?aba=privacidade");
  await page.getByRole("button", { name: "Excluir minha conta" }).click();
  const dialog = page.getByRole("dialog", { name: "Excluir a conta definitivamente?" });
  await dialog.getByLabel("Para confirmar, digite EXCLUIR").fill("apagar");
  await dialog.getByRole("button", { name: "Excluir definitivamente" }).click();
  await expect(dialog.getByText("Digite EXCLUIR para confirmar.").first()).toBeVisible();
  await dialog.getByLabel("Para confirmar, digite EXCLUIR").fill("excluir");
  await dialog.getByRole("button", { name: "Excluir definitivamente" }).click();
  await page.waitForURL(/\/\?conta=excluida/);
  await expect(page.getByText("Sua conta e os seus dados foram excluídos.")).toBeVisible();

  for (const table of ["profiles", "projects", "conversations", "messages", "files"]) {
    const column = table === "profiles" ? "id" : "user_id";
    expect((await admin.from(table).select(column).eq(column, user.id)).data, table).toEqual([]);
  }
  const stored = await admin.storage.from("anexos").download(files![0].storage_path);
  expect(stored.error).not.toBeNull();

  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(user.email);
  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
});
