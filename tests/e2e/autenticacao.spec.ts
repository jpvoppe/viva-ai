import { expect, test } from "@playwright/test";
import { adminClient, createReadyUser, deleteTestUsers, hasTestDatabase, latestMailTo, login, resetRateLimits } from "./helpers";

test.skip(!hasTestDatabase, "Requer Supabase de teste configurado.");
test.afterAll(async () => {
  await deleteTestUsers();
});
test.beforeEach(async () => {
  await resetRateLimits();
});

test("cadastro completo: conta, boas-vindas e entrada no app", async ({ page }) => {
  const email = `cadastro-${Date.now()}@teste.viva.local`;
  await page.goto("/criar-conta");

  // Validação: nada preenchido.
  await page.getByRole("button", { name: "Criar conta gratuita" }).click();
  await expect(page.getByText("Informe como quer ser chamado.")).toBeVisible();
  await expect(page.getByText("Para criar a conta, é preciso aceitar os termos.")).toBeVisible();

  await page.getByLabel("Como quer ser chamado?").fill("Marina");
  await page.getByLabel("E-mail").fill(email);
  await page.locator("#password").fill("curta1");
  await page.getByLabel("Data de nascimento").fill("1992-04-12");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta gratuita" }).click();
  await expect(page.getByText("A senha precisa ter pelo menos 8 caracteres.")).toBeVisible();
  // O que já foi digitado continua no formulário.
  await expect(page.getByLabel("Como quer ser chamado?")).toHaveValue("Marina");

  await page.locator("#password").fill("senha1234");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta gratuita" }).click();
  await page.waitForURL("**/app/boas-vindas");
  await expect(page.getByRole("heading", { name: /Olá, Marina/ })).toBeVisible();

  await page.getByRole("button", { name: "Avançar" }).click();
  await page.getByRole("checkbox", { name: "Estudar e aprender" }).click();
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.getByRole("radio", { name: /Direto/ }).click();
  await page.getByRole("button", { name: "Avançar" }).click();
  await expect(page.getByRole("heading", { name: "Seus dados, suas regras" })).toBeVisible();
  await page.getByRole("button", { name: "Entrar no VIVA", exact: true }).click();
  await page.waitForURL(/\/app$/);
  await expect(page.getByRole("heading", { name: "O que vamos resolver hoje?" })).toBeVisible();

  // O que foi escolhido ficou gravado; a data de nascimento, não.
  const admin = adminClient();
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const created = users.users.find((u) => u.email === email)!;
  const { data: prefs } = await admin.from("user_preferences").select("goals, response_style, memory_enabled").eq("user_id", created.id).single();
  expect(prefs).toEqual({ goals: ["estudar"], response_style: "direto", memory_enabled: false });
  const { data: profile } = await admin.from("profiles").select("*").eq("id", created.id).single();
  expect(profile.age_band).toBe("adulto");
  expect(JSON.stringify(profile)).not.toContain("1992");
  expect(JSON.stringify(created.user_metadata)).not.toContain("1992");
  await admin.auth.admin.deleteUser(created.id);
});

test("menores de 13 anos não conseguem criar conta; 13 a 17 entram como adolescentes", async ({ page }) => {
  const year = new Date().getFullYear();
  await page.goto("/criar-conta");
  await page.getByLabel("Como quer ser chamado?").fill("Criança");
  await page.getByLabel("E-mail").fill(`crianca-${Date.now()}@teste.viva.local`);
  await page.locator("#password").fill("senha1234");
  await page.getByLabel("Data de nascimento").fill(`${year - 10}-01-01`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta gratuita" }).click();
  await expect(page.getByText(/a partir de 13 anos/)).toBeVisible();
  await expect(page).toHaveURL(/criar-conta/);

  const teenEmail = `adolescente-${Date.now()}@teste.viva.local`;
  await page.getByLabel("E-mail").fill(teenEmail);
  await page.locator("#password").fill("senha1234");
  await page.getByLabel("Data de nascimento").fill(`${year - 15}-01-01`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta gratuita" }).click();
  await page.waitForURL("**/app/boas-vindas");
  const admin = adminClient();
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const teen = users.users.find((u) => u.email === teenEmail)!;
  const { data: profile } = await admin.from("profiles").select("age_band").eq("id", teen.id).single();
  expect(profile?.age_band).toBe("adolescente");
  await admin.auth.admin.deleteUser(teen.id);
});

test("login: senha errada, sucesso, sessão persistente e saída", async ({ page }) => {
  const user = await createReadyUser("login");
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(user.email);
  await page.locator("#password").fill("senha-errada-1");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "E-mail ou senha incorretos." })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toHaveValue(user.email);

  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/app$/);

  // Recarregar mantém a sessão; quem está logado não vê a tela de entrada.
  await page.reload();
  await expect(page.getByRole("heading", { name: "O que vamos resolver hoje?" })).toBeVisible();
  await page.goto("/entrar");
  await page.waitForURL(/\/app$/);

  await page.getByRole("button", { name: /^Conta de/ }).first().click();
  await page.getByRole("menuitem", { name: "Sair da conta" }).click();
  await page.waitForURL(/\/entrar/);
  await expect(page.getByText("Você saiu da sua conta.")).toBeVisible();

  // Depois de sair, a área logada volta a exigir login.
  await page.goto("/app/organizador");
  await page.waitForURL(/\/entrar/);
});

test("rota protegida leva ao login e depois volta para onde a pessoa queria ir", async ({ page }) => {
  const user = await createReadyUser("volta");
  await page.goto("/app/projetos");
  await page.waitForURL(/\/entrar\?voltar=/);
  await page.getByLabel("E-mail").fill(user.email);
  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/app\/projetos$/);
});

test("o parâmetro de retorno não redireciona para fora do site", async ({ page }) => {
  const user = await createReadyUser("redir");
  await page.goto("/entrar?voltar=https://exemplo-malicioso.test/roubo");
  await page.getByLabel("E-mail").fill(user.email);
  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/localhost:\d+\/app$/);
});

test("quem ainda não concluiu as boas-vindas é levado a elas, e pode pular", async ({ page }) => {
  const admin = adminClient();
  const user = await createReadyUser("pular");
  await admin.from("profiles").update({ onboarding_completed_at: null }).eq("id", user.id);
  await login(page, user, /boas-vindas/);
  await page.goto("/app/organizador");
  await page.waitForURL(/boas-vindas/);
  await page.getByRole("button", { name: "Pular e entrar no VIVA" }).click();
  await page.waitForURL(/\/app$/);
});

test("recuperação de senha por e-mail, do pedido até entrar com a senha nova", async ({ page }) => {
  const user = await createReadyUser("recuperar");
  await page.goto("/recuperar-senha");
  await page.getByLabel("E-mail da sua conta").fill(user.email);
  await page.getByRole("button", { name: "Enviar link de recuperação" }).click();
  await expect(page.getByText(/Se existir uma conta com este e-mail/)).toBeVisible();

  let mail: string | null = null;
  await expect
    .poll(async () => (mail = await latestMailTo(user.email)), { timeout: 15_000 })
    .not.toBeNull();
  test.skip(mail === null, "Sem coletor de e-mails neste ambiente.");
  const link = /(https?:\/\/[^\s"<>]+\/verify\?[^\s"<>]+)/.exec(mail!)?.[1];
  expect(link, "o e-mail traz um link de recuperação").toBeTruthy();

  await page.goto(link!);
  await page.waitForURL(/\/redefinir-senha/);
  await page.locator("#password").fill("novaSenha456");
  await page.locator("#confirm").fill("outraCoisa456");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page.getByText("As duas senhas precisam ser iguais.")).toBeVisible();
  await page.locator("#password").fill("novaSenha456");
  await page.locator("#confirm").fill("novaSenha456");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await page.waitForURL(/\/app\?aviso=senha-alterada/);
  await expect(page.getByText("Senha alterada.")).toBeVisible();

  // A senha antiga deixa de valer.
  await page.context().clearCookies();
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(user.email);
  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  await login(page, { email: user.email, password: "novaSenha456" });
});

test("pedir recuperação para e-mail inexistente dá a mesma resposta (não revela quem tem conta)", async ({ page }) => {
  await page.goto("/recuperar-senha");
  await page.getByLabel("E-mail da sua conta").fill(`ninguem-${Date.now()}@teste.viva.local`);
  await page.getByRole("button", { name: "Enviar link de recuperação" }).click();
  await expect(page.getByText(/Se existir uma conta com este e-mail/)).toBeVisible();
});

test("muitas tentativas de login seguidas são bloqueadas por um tempo", async ({ page }) => {
  const user = await createReadyUser("forca-bruta");
  await page.goto("/entrar");
  for (let i = 0; i < 11; i++) {
    await page.getByLabel("E-mail").fill(user.email);
    await page.locator("#password").fill(`tentativa-${i}`);
    const response = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/entrar"));
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await response;
    await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeEnabled();
  }
  await expect(page.getByText(/Muitas tentativas em pouco tempo/)).toBeVisible();
});
