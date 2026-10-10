import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { appReady, createReadyUser, deleteTestUsers, hasTestDatabase, login, sendMessage, waitForAnswer, type TestUser } from "./helpers";

test.afterAll(async () => {
  await deleteTestUsers();
});

/** Regras WCAG 2.x níveis A e AA verificáveis automaticamente (axe-core). */
async function expectNoViolations(page: Page, context: string) {
  // O axe traz tipos de outra versão do Playwright; em execução o objeto é o mesmo.
  const results = await new AxeBuilder({ page: page as never }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(summary, `violações de acessibilidade em ${context}`).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`tema ${scheme === "light" ? "claro" : "escuro"}`, () => {
    test.use({ colorScheme: scheme });

    for (const path of ["/", "/planos", "/entrar", "/criar-conta", "/recuperar-senha", "/privacidade"]) {
      test(`página pública ${path} sem violações`, async ({ page }) => {
        await page.goto(path);
        if (path === "/") await page.waitForTimeout(5500); // espera a demonstração terminar
        await expectNoViolations(page, path);
      });
    }

    test("área logada sem violações (início, conversa, organizador, criar, aprender, projetos, histórico, configurações)", async ({ page }) => {
      test.skip(!hasTestDatabase, "Requer Supabase de teste configurado.");
      test.setTimeout(120_000);
      const user: TestUser = await createReadyUser(`a11y-${scheme}`);
      await login(page, user);
      await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
      await expectNoViolations(page, "/app");

      await page.goto("/app/assistente");
      await sendMessage(page, "Olá");
      await waitForAnswer(page);
      await expectNoViolations(page, "conversa");

      for (const [path, ready] of [
        ["/app/organizador", "Organizador"],
        ["/app/organizador?aba=calendario", "Organizador"],
        ["/app/criar", "Criar"],
        ["/app/criar/mensagem", "Rascunho de mensagem"],
        ["/app/criar/conversor", "Conversor de unidades"],
        ["/app/aprender", "Aprender"],
        ["/app/projetos", "Projetos"],
        ["/app/historico", "Histórico"],
        ["/app/configuracoes", "Configurações"],
        ["/app/configuracoes?aba=preferencias", "Configurações"],
        ["/app/configuracoes?aba=assinatura", "Configurações"],
        ["/app/configuracoes?aba=progresso", "Configurações"],
      ] as const) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1, name: ready })).toBeVisible();
        await expectNoViolations(page, path);
      }

      // Janela aberta também é verificada.
      await page.goto("/app/organizador");
      await page.getByRole("button", { name: "Criar tarefa com data, prioridade e repetição" }).click();
      await expect(page.getByRole("dialog", { name: "Nova tarefa" })).toBeVisible();
      await expectNoViolations(page, "janela de nova tarefa");
    });
  });
}

test.describe("teclado", () => {
  test.skip(!hasTestDatabase, "Requer Supabase de teste configurado.");

  test("link de pular para o conteúdo é o primeiro foco e funciona", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Pular para o conteúdo" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#conteudo$/);
  });

  test("login inteiro só com o teclado, e foco sempre visível", async ({ page }) => {
    const user = await createReadyUser("teclado");
    await page.goto("/entrar");
    await page.getByLabel("E-mail").focus();
    await page.keyboard.type(user.email);
    await page.keyboard.press("Tab");
    await page.keyboard.type(user.password);
    const outline = await page.locator("#password").evaluate((el) => {
      const s = getComputedStyle(el);
      return s.outlineStyle !== "none" || s.boxShadow !== "none";
    });
    expect(outline).toBe(true);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/app$/);
  });

  test("janelas prendem o foco, fecham com Esc e devolvem o foco; menus navegam por setas", async ({ page }) => {
    const user = await createReadyUser("foco");
    await login(page, user);
    await page.goto("/app/organizador");
    await appReady(page);
    const trigger = page.getByRole("button", { name: "Criar tarefa com data, prioridade e repetição" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Nova tarefa" });
    await expect(dialog.getByLabel("O que precisa ser feito?")).toBeFocused();
    // Tab várias vezes: o foco não escapa da janela.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    // Menu da conta: abre com Enter, anda com seta, fecha com Esc.
    const account = page.getByRole("button", { name: /^Conta de/ }).first();
    await account.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await expect(page.getByRole("menuitem").first()).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem").nth(1)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(account).toBeFocused();
  });

  test("atalhos: Ctrl+K abre nova conversa e ? mostra a lista de atalhos", async ({ page }) => {
    const user = await createReadyUser("atalhos");
    await login(page, user);
    await appReady(page);
    await page.keyboard.press("Control+k");
    await page.waitForURL(/\/app\/assistente$/);
    await page.locator("body").click({ position: { x: 600, y: 300 } });
    await page.keyboard.press("?");
    await expect(page.getByRole("dialog", { name: "Atalhos de teclado" })).toBeVisible();
  });
});

test("quem prefere menos movimento não recebe animações em laço", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  // A demonstração aparece direto no estado final, sem digitação animada.
  await expect(page.getByText("Quinta: um questionário de 10 perguntas", { exact: false })).toBeAttached({ timeout: 1500 });
  const durations = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>(".orb__swirl, .orb__body")).map((el) => getComputedStyle(el).animationName),
  );
  expect(durations.every((name) => name === "none")).toBe(true);
  await context.close();
});
