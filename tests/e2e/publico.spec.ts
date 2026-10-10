import { expect, test } from "@playwright/test";
import { noHorizontalOverflow } from "./helpers";
import { PLANS } from "../../src/lib/plans";

test("página inicial: proposta de valor, limites reais do plano gratuito e nenhum dado inventado", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "O assistente inteligente para a vida cotidiana" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Criar conta gratuita" }).first()).toHaveAttribute("href", "/criar-conta");
  await expect(page.getByText("Exemplo ilustrativo da tela de conversa.", { exact: false })).toBeVisible();
  await expect(page.getByText(`${PLANS.gratuito.limits.dailyMessages} mensagens ao assistente por dia`).first()).toBeVisible();
  // Sem Stripe configurado, o preço não é inventado.
  await expect(page.getByText("Preço a definir").first()).toBeVisible();
  const body = (await page.locator("body").innerText()).toLowerCase();
  for (const forbidden of ["milhões de usuários", "depoimento", "prêmio", "ilimitad", "garantid"]) {
    expect(body, `a página não pode conter “${forbidden}”`).not.toContain(forbidden);
  }

  // Perguntas frequentes abrem e fecham.
  const faq = page.locator("details").filter({ hasText: "O VIVA acerta sempre?" });
  await faq.locator("summary").click();
  await expect(faq.getByText("Não. Como toda inteligência artificial", { exact: false })).toBeVisible();
  await noHorizontalOverflow(page);
});

test("SEO técnico: metadados, dados estruturados, robots e sitemap", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/VIVA AI/);
  expect(await page.locator('meta[name="description"]').getAttribute("content")).toMatch(/estudar|organizar/i);
  expect(await page.locator('meta[property="og:title"]').getAttribute("content")).toContain("VIVA AI");
  expect(await page.locator('meta[property="og:image"]').getAttribute("content")).toContain("/opengraph-image");
  expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toMatch(/^https?:\/\/[^/]+\/?$/);
  expect(await page.locator("html").getAttribute("lang")).toBe("pt-BR");
  const jsonLd = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
  expect(jsonLd["@graph"].map((n: { "@type": string }) => n["@type"])).toEqual(["SoftwareApplication", "FAQPage"]);

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /app");
  expect(robots).toContain("Disallow: /api");
  expect(robots).toContain("Sitemap:");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/planos");
  expect(sitemap).not.toContain("/app");
  expect((await request.get("/opengraph-image")).headers()["content-type"]).toContain("image/png");
  expect((await request.get("/manifest.webmanifest")).ok()).toBe(true);

  // Páginas de login não são indexadas.
  await page.goto("/entrar");
  expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
});

test("planos, privacidade e termos estão publicados e legíveis", async ({ page }) => {
  await page.goto("/planos");
  await expect(page.getByRole("heading", { level: 1, name: "Planos e limites" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "VIVA Plus" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "VIVA Família" })).toBeVisible();
  await noHorizontalOverflow(page);

  await page.goto("/privacidade");
  await expect(page.getByRole("heading", { level: 1, name: "Política de privacidade" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Seus direitos" })).toBeVisible();
  await expect(page.getByText("a data não é armazenada", { exact: false })).toBeVisible();

  await page.goto("/termos");
  await expect(page.getByRole("heading", { level: 1, name: "Termos de uso" })).toBeVisible();
  await expect(page.getByText("O VIVA pode errar.")).toBeVisible();
});

test("endereço inexistente mostra página de erro útil, com caminho de volta", async ({ page }) => {
  const response = await page.goto("/pagina-que-nao-existe");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Esta página não existe" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Página inicial do site" })).toBeVisible();
});

test("verificação de saúde responde sem expor detalhes", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ status: "ok", app: true, banco: true });
});

test("cabeçalhos de segurança estão presentes", async ({ request }) => {
  const headers = (await request.get("/")).headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["permissions-policy"]).toContain("microphone=(self)");
  expect(headers["x-powered-by"]).toBeUndefined();
});
