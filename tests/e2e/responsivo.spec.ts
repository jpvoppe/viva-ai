import { expect, test } from "@playwright/test";
import { createReadyUser, deleteTestUsers, hasTestDatabase, login, noHorizontalOverflow, sendMessage, waitForAnswer } from "./helpers";

test.skip(!hasTestDatabase, "Requer Supabase de teste configurado.");
test.afterAll(async () => {
  await deleteTestUsers();
});

const PAGES = [
  "/app", "/app/assistente", "/app/organizador", "/app/organizador?aba=calendario", "/app/organizador?aba=listas",
  "/app/criar", "/app/criar/viagem", "/app/criar/conversor", "/app/aprender", "/app/projetos", "/app/historico",
  "/app/configuracoes", "/app/configuracoes?aba=assinatura", "/app/configuracoes?aba=progresso", "/app/configuracoes?aba=privacidade",
];

for (const width of [320, 360, 768, 1024, 1440]) {
  test(`sem rolagem horizontal em ${width}px (páginas públicas e do app)`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 800 });
    for (const path of ["/", "/planos", "/entrar", "/criar-conta", "/privacidade"]) {
      await page.goto(path);
      await noHorizontalOverflow(page);
    }
    const user = await createReadyUser(`resp-${width}`);
    await login(page, user);
    for (const path of PAGES) {
      await page.goto(path);
      await expect(page.locator("#conteudo")).toBeVisible();
      await page.waitForLoadState("networkidle");
      await noHorizontalOverflow(page);
    }
    await page.goto("/app/assistente");
    await sendMessage(page, "Teste de largura com bloco de código e tabela");
    await waitForAnswer(page);
    await noHorizontalOverflow(page);
  });
}

test("navegação: barra inferior no celular, menu lateral no computador", async ({ page, isMobile }) => {
  const user = await createReadyUser("nav");
  await login(page, user);
  const bottom = page.locator("[data-bottom-nav]");
  const sidebar = page.getByRole("complementary", { name: "Menu principal" });

  if (isMobile) {
    await expect(bottom).toBeVisible();
    await expect(sidebar).toBeHidden();
    // Poucas opções essenciais, com área de toque confortável.
    const items = bottom.locator("a, button");
    await expect(items).toHaveCount(5);
    for (const box of await items.evaluateAll((els) => els.map((el) => el.getBoundingClientRect()))) {
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
    await bottom.getByRole("link", { name: "Organizador" }).click();
    await page.waitForURL(/\/app\/organizador$/);
    await expect(bottom.getByRole("link", { name: "Organizador" })).toHaveAttribute("aria-current", "page");

    await bottom.getByRole("button", { name: "Mais" }).click();
    const more = page.getByRole("dialog", { name: "Mais opções" });
    await more.getByRole("link", { name: "Histórico" }).click();
    await page.waitForURL(/\/app\/historico$/);
    await expect(more).toBeHidden();
  } else {
    await expect(sidebar).toBeVisible();
    await expect(bottom).toBeHidden();
    await sidebar.getByRole("link", { name: "Projetos" }).click();
    await page.waitForURL(/\/app\/projetos$/);
    await expect(sidebar.getByRole("link", { name: "Projetos" })).toHaveAttribute("aria-current", "page");

    // Recolher o menu mantém os itens acessíveis e a escolha fica salva.
    await page.getByRole("button", { name: "Recolher menu lateral" }).click();
    await expect(sidebar.getByRole("link", { name: "Projetos" })).toBeVisible();
    expect((await sidebar.boundingBox())!.width).toBeLessThan(100);
    await page.reload();
    await expect(page.getByRole("button", { name: "Abrir menu lateral" })).toBeVisible();
  }
});

test("celular: campo de mensagem alcançável e botões com tamanho de toque", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Só no perfil de celular.");
  const user = await createReadyUser("toque");
  await login(page, user);
  await page.goto("/app/assistente");
  const field = page.getByLabel("Mensagem para o VIVA");
  await field.tap();
  await expect(field).toBeFocused();
  await expect(field).toBeInViewport();
  // Campo com 16px ou mais: o iPhone não dá zoom automático ao focar.
  expect(parseFloat(await field.evaluate((el) => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  for (const name of ["Enviar mensagem", "Anexar arquivo"]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box!.width, name).toBeGreaterThanOrEqual(44);
    expect(box!.height, name).toBeGreaterThanOrEqual(44);
  }
  await sendMessage(page, "Mensagem pelo celular");
  await waitForAnswer(page);
  await expect(page.getByRole("button", { name: "Enviar mensagem" })).toBeInViewport();
});
