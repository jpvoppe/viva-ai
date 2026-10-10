import { expect, type Page } from "@playwright/test";
import { adminClient, createTestUser, deleteTestUsers, hasTestDatabase, SUPABASE_URL, type TestUser } from "../helpers/supabase";

export { adminClient, createTestUser, deleteTestUsers, hasTestDatabase, type TestUser };

/** Os testes fazem muitos logins seguidos da mesma máquina: zera o contador de limite entre eles. */
export async function resetRateLimits(): Promise<void> {
  await adminClient().from("rate_limits").delete().neq("key", "");
}

/** Cria um usuário já com o primeiro acesso concluído. */
export async function createReadyUser(label: string, extra: Record<string, unknown> = {}): Promise<TestUser> {
  const user = await createTestUser(label);
  const admin = adminClient();
  await admin.from("profiles").update({ onboarding_completed_at: new Date().toISOString(), ...extra }).eq("id", user.id);
  return user;
}

export async function login(page: Page, user: { email: string; password: string }, expectUrl: string | RegExp = /\/app$/): Promise<void> {
  await resetRateLimits();
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(user.email);
  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(expectUrl);
}

/** Espera o app ficar interativo (atalhos e botões já respondem). */
export async function appReady(page: Page): Promise<void> {
  await page.waitForFunction(() => document.documentElement.dataset.appPronto === "1");
}

/** Espera a tela de conversa ficar interativa (o React assumir os controles). */
export async function chatReady(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const el = document.getElementById("mensagem");
    return Boolean(el && Object.keys(el).some((key) => key.startsWith("__reactProps")));
  });
}

export async function sendMessage(page: Page, text: string): Promise<void> {
  await chatReady(page);
  await page.getByLabel("Mensagem para o VIVA").fill(text);
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
}

export async function waitForAnswer(page: Page): Promise<void> {
  await expect(page.locator('[data-role="assistant"][data-streaming]')).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('[data-role="assistant"]').last()).toBeVisible();
}

export async function noHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "a página não pode ter rolagem horizontal").toBeLessThanOrEqual(1);
}

/** Último e-mail enviado pelo serviço de login local (só existe no ambiente de teste local). */
export async function latestMailTo(email: string): Promise<string | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/_mail?to=${encodeURIComponent(email)}`);
    if (!response.ok) return null;
    const list = (await response.json()) as { body: string }[];
    const body = list.at(-1)?.body;
    if (!body) return null;
    // O corpo vem em "quoted-printable": junta as linhas e desfaz os =3D.
    return body.replace(/=\r?\n/g, "").replace(/=3D/g, "=").replace(/&amp;/g, "&");
  } catch {
    return null;
  }
}
