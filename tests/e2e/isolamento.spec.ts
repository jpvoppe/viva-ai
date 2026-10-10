import { expect, test } from "@playwright/test";
import { adminClient, createReadyUser, deleteTestUsers, hasTestDatabase, login } from "./helpers";

test.skip(!hasTestDatabase, "Requer Supabase de teste configurado.");
test.afterAll(async () => {
  await deleteTestUsers();
});

test("um usuário não abre conversa, projeto, criação, baralho nem arquivo de outro, mesmo com o endereço exato", async ({ page }) => {
  const admin = adminClient();
  const ana = await createReadyUser("dona");
  const bruno = await createReadyUser("curioso");

  const { data: conversation } = await admin.from("conversations").insert({ user_id: ana.id, title: "Diário da Ana" }).select("id").single();
  await admin.from("messages").insert({ conversation_id: conversation!.id, user_id: ana.id, role: "user", content: "segredo absoluto da Ana" });
  const { data: project } = await admin.from("projects").insert({ user_id: ana.id, name: "Projeto confidencial" }).select("id").single();
  const { data: doc } = await admin.from("documents").insert({ user_id: ana.id, tool: "mensagem", title: "Carta", content: "texto reservado" }).select("id").single();
  const { data: deck } = await admin.from("study_decks").insert({ user_id: ana.id, title: "Baralho reservado" }).select("id").single();
  const path = `${ana.id}/reservado.txt`;
  await admin.storage.from("anexos").upload(path, new Blob(["conteúdo reservado"], { type: "text/plain" }));
  const { data: file } = await admin.from("files").insert({ user_id: ana.id, name: "reservado.txt", mime_type: "text/plain", size_bytes: 10, kind: "documento", storage_path: path }).select("id").single();

  await login(page, bruno);
  for (const url of [
    `/app/assistente/${conversation!.id}`,
    `/app/projetos/${project!.id}`,
    `/app/criar/documento/${doc!.id}`,
    `/app/aprender/baralho/${deck!.id}`,
  ]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Esta página não existe" }), url).toBeVisible();
    await expect(page.getByText("segredo absoluto")).toHaveCount(0);
    await expect(page.getByText("Projeto confidencial")).toHaveCount(0);
  }

  // Rotas de dados: mesmas recusas.
  expect((await page.request.get(`/api/files/${file!.id}`)).status()).toBe(404);
  expect((await page.request.delete(`/api/files/${file!.id}`)).status()).toBe(404);
  const chat = await page.request.post("/api/chat", { data: { conversationId: conversation!.id, content: "leia a conversa" } });
  expect(chat.status()).toBe(404);
  const withFile = await page.request.post("/api/chat", { data: { content: "abra o arquivo", fileIds: [file!.id] } });
  expect(withFile.status()).toBe(404);
  const inProject = await page.request.post("/api/chat", { data: { content: "sobre o projeto", projectId: project!.id } });
  expect(inProject.status()).toBe(404);

  // A busca e a exportação do curioso não trazem nada da dona.
  await page.goto("/app/historico");
  await page.getByLabel("Buscar nas conversas").fill("segredo");
  await expect(page.getByRole("heading", { name: "Nada encontrado" })).toBeVisible();
  const exported = await (await page.request.get("/api/account/export")).text();
  expect(exported).not.toContain("segredo absoluto");
  expect(exported).not.toContain("Projeto confidencial");

  // E nada foi alterado.
  expect((await admin.from("messages").select("id").eq("conversation_id", conversation!.id)).data).toHaveLength(1);
  await admin.storage.from("anexos").remove([path]);
});

test("rotas de dados exigem sessão e recusam chamadas de outro site", async ({ page, request }) => {
  for (const [method, url] of [
    ["post", "/api/chat"],
    ["post", "/api/generate"],
    ["post", "/api/generate/structured"],
    ["post", "/api/files"],
    ["get", "/api/account/export"],
  ] as const) {
    const response = method === "post" ? await request.post(url, { data: { content: "oi", kind: "etapas", nome: "x" } }) : await request.get(url);
    expect(response.status(), url).toBe(401);
  }

  const user = await createReadyUser("origem");
  await login(page, user);
  const forged = await page.request.post("/api/chat", { data: { content: "oi" }, headers: { origin: "https://site-malicioso.test" } });
  expect(forged.status()).toBe(403);
  const invalid = await page.request.post("/api/chat", { data: { content: "" } });
  expect(invalid.status()).toBe(400);
  const badId = await page.request.post("/api/chat", { data: { content: "oi", conversationId: "1; drop table" } });
  expect(badId.status()).toBe(400);
});

test("painel administrativo: fechado para usuários comuns, aberto e funcional para administradores", async ({ page }) => {
  const admin = adminClient();
  const common = await createReadyUser("comum");
  await login(page, common);
  await page.goto("/admin");
  await page.waitForURL(/\/app$/);
  await page.getByRole("button", { name: /^Conta de/ }).first().click();
  await expect(page.getByRole("menuitem", { name: "Painel administrativo" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await admin.from("profiles").update({ role: "admin" }).eq("id", common.id);
  await admin.from("feedback").insert({ user_id: common.id, category: "sugestao", comment: "Sugestão de teste para o painel" });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1, name: "Painel administrativo" })).toBeVisible();
  await expect(page.getByText("IA SIMULADA em uso (modo de teste)")).toBeVisible();
  await expect(page.getByText("Sugestão de teste para o painel")).toBeVisible();
  // Agregado: o painel não mostra e-mails de usuários.
  await expect(page.getByRole("main")).not.toContainText("@teste.viva.local");

  // Desligar um recurso vale na hora e fica registrado.
  await page.getByRole("switch", { name: "Ferramentas de criação de conteúdo" }).click();
  await expect(page.getByText("Recurso desativado.")).toBeVisible();
  try {
    await page.goto("/app/criar");
    await expect(page.getByText("As ferramentas de criação estão desativadas no momento.")).toBeVisible();
    const blocked = await page.request.post("/api/generate", { data: { tool: "mensagem", values: { objetivo: "teste" } } });
    expect(blocked.status()).toBe(403);
    await page.goto("/admin");
    await expect(page.getByText("ferramentas_criacao = false").first()).toBeVisible();
  } finally {
    await admin.from("feature_flags").update({ enabled: true }).eq("key", "ferramentas_criacao");
  }
});
