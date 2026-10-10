import { expect, test } from "@playwright/test";
import { adminClient, createReadyUser, deleteTestUsers, hasTestDatabase, login, noHorizontalOverflow, type TestUser } from "./helpers";

test.skip(!hasTestDatabase, "Requer Supabase de teste configurado.");
test.afterAll(async () => {
  await deleteTestUsers();
});

let user: TestUser;
test.beforeEach(async ({ page }) => {
  user = await createReadyUser("organizador");
  await login(page, user);
  await page.goto("/app/organizador");
});

const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

test("tarefas: criar, concluir, reabrir, editar e excluir, tudo persistido", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Nenhuma tarefa por aqui" })).toBeVisible();

  const quick = page.getByLabel("Adicionar tarefa — escreva e aperte Enter");
  await quick.fill("Comprar pão");
  await quick.press("Enter");
  await expect(page.getByText("Comprar pão")).toBeVisible();
  await expect(quick).toHaveValue("");

  // Tarefa completa pela janela.
  await page.getByRole("button", { name: "Criar tarefa com data, prioridade e repetição" }).click();
  const dialog = page.getByRole("dialog", { name: "Nova tarefa" });
  await dialog.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(dialog.getByLabel("O que precisa ser feito?")).toBeFocused(); // campo obrigatório
  await dialog.getByLabel("O que precisa ser feito?").fill("Pagar o boleto");
  await dialog.getByLabel("Data").fill(todayIso());
  await dialog.getByLabel("Prioridade").selectOption("1");
  await dialog.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(dialog).toBeHidden();
  const todaySection = page.getByRole("region", { name: "Hoje" });
  await expect(todaySection.getByText("Pagar o boleto")).toBeVisible();
  await expect(todaySection.getByText("Prioridade alta")).toBeVisible();

  // Concluir.
  await page.getByRole("checkbox", { name: "Concluir tarefa: Comprar pão" }).click();
  await expect(page.getByRole("button", { name: /Concluídas/ })).toBeVisible();
  await expect.poll(async () => (await adminClient().from("tasks").select("completed_at").eq("user_id", user.id).eq("title", "Comprar pão").single()).data?.completed_at).not.toBeNull();

  // Recarregar mantém o estado; reabrir funciona.
  await page.reload();
  await page.getByRole("button", { name: /Concluídas/ }).click();
  await page.getByRole("checkbox", { name: "Reabrir tarefa: Comprar pão" }).click();
  await expect(page.getByRole("checkbox", { name: "Concluir tarefa: Comprar pão" })).toBeVisible();

  // Editar.
  await page.getByRole("button", { name: "Opções da tarefa: Comprar pão" }).click();
  await page.getByRole("menuitem", { name: "Editar tarefa" }).click();
  const edit = page.getByRole("dialog", { name: "Editar tarefa" });
  await edit.getByLabel("O que precisa ser feito?").fill("Comprar pão integral");
  await edit.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Comprar pão integral")).toBeVisible();

  // Excluir, com confirmação.
  await page.getByRole("button", { name: "Opções da tarefa: Pagar o boleto" }).click();
  await page.getByRole("menuitem", { name: "Excluir tarefa" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir tarefa" }).click();
  await expect(page.getByText("Pagar o boleto")).toHaveCount(0);
  const { data: rows } = await adminClient().from("tasks").select("title").eq("user_id", user.id);
  expect(rows?.map((r) => r.title)).toEqual(["Comprar pão integral"]);
  await noHorizontalOverflow(page);
});

test("tarefa que se repete cria a próxima ocorrência ao ser concluída", async ({ page }) => {
  await page.getByRole("button", { name: "Criar tarefa com data, prioridade e repetição" }).click();
  const dialog = page.getByRole("dialog", { name: "Nova tarefa" });
  await dialog.getByLabel("O que precisa ser feito?").fill("Regar as plantas");
  await dialog.getByLabel("Data").fill(todayIso());
  await dialog.getByLabel("Repetição").selectOption("semanal");
  await dialog.getByRole("button", { name: "Criar tarefa" }).click();
  await page.getByRole("checkbox", { name: "Concluir tarefa: Regar as plantas" }).click();
  await expect(page.getByText("A próxima ocorrência já foi criada.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Próximos 7 dias" }).getByText("Regar as plantas")).toBeVisible();
  const { data: rows } = await adminClient().from("tasks").select("due_date, completed_at").eq("user_id", user.id).order("due_date");
  expect(rows).toHaveLength(2);
  expect(rows?.[0].completed_at).not.toBeNull();
  expect(rows?.[1].completed_at).toBeNull();
  const days = (new Date(rows![1].due_date).getTime() - new Date(rows![0].due_date).getTime()) / 86_400_000;
  expect(days).toBe(7);
});

test("calendário mostra as tarefas do dia e cria tarefa na data escolhida", async ({ page }) => {
  await page.getByRole("tab", { name: "Calendário" }).click();
  await expect(page).toHaveURL(/aba=calendario/);
  await page.getByRole("button", { name: "Criar tarefa neste dia" }).click();
  const dialog = page.getByRole("dialog", { name: "Nova tarefa" });
  await expect(dialog.getByLabel("Data")).toHaveValue(todayIso());
  await dialog.getByLabel("O que precisa ser feito?").fill("Consulta médica");
  await dialog.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(page.getByRole("region", { name: /Tarefas de/ }).getByText("Consulta médica")).toBeVisible();
  await expect(page.getByRole("button", { pressed: true, name: /1 em aberto/ })).toBeVisible();
  await page.getByRole("button", { name: "Próximo mês" }).click();
  await page.getByRole("button", { name: "Hoje", exact: true }).click();
  await expect(page.getByText("Consulta médica")).toBeVisible();
  await noHorizontalOverflow(page);
});

test("listas: criar, adicionar, marcar, limpar marcados e excluir", async ({ page }) => {
  await page.getByRole("tab", { name: "Listas" }).click();
  await page.getByRole("button", { name: "Criar lista" }).click();
  await page.getByLabel("Nome da lista").fill("Feira de sábado");
  await page.getByLabel("Tipo").selectOption("compras");
  await page.getByRole("dialog").getByRole("button", { name: "Criar lista" }).click();
  const list = page.getByRole("region", { name: "Lista Feira de sábado" });
  for (const item of ["Tomate", "Banana"]) {
    await list.getByLabel("Novo item em Feira de sábado").fill(item);
    await list.getByRole("button", { name: "Adicionar item" }).click();
    await expect(list.getByText(item)).toBeVisible();
  }
  // A tela marca na hora e grava em seguida; espera a gravação terminar antes de recarregar.
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/app/organizador")),
    list.getByRole("checkbox", { name: "Tomate" }).check(),
  ]);
  await expect(list.getByText("1 de 2 marcados")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "Lista Feira de sábado" }).getByRole("checkbox", { name: "Tomate" })).toBeChecked();
  await page.getByRole("button", { name: "Remover itens marcados" }).click();
  await expect(page.getByText("Tomate")).toHaveCount(0);
  await page.getByRole("button", { name: "Excluir lista Feira de sábado" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir lista" }).click();
  await expect(page.getByRole("heading", { name: "Nenhuma lista ainda" })).toBeVisible();
  expect((await adminClient().from("lists").select("id").eq("user_id", user.id)).data).toEqual([]);
});

test("objetivos: progresso atualizado até alcançar a meta", async ({ page }) => {
  await page.getByRole("tab", { name: "Objetivos" }).click();
  await page.getByRole("button", { name: "Criar objetivo" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo objetivo" });
  await dialog.getByLabel("Qual é o objetivo?").fill("Ler mais");
  await dialog.getByLabel("Meta (número)").fill("0");
  await dialog.getByRole("button", { name: "Criar objetivo" }).click();
  // Meta zero é barrada já no formulário (e de novo no servidor).
  await expect(dialog).toBeVisible();
  expect(await dialog.getByLabel("Meta (número)").evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
  await dialog.getByLabel("Meta (número)").fill("12");
  await dialog.getByLabel("Unidade").fill("livros");
  await dialog.getByRole("button", { name: "Criar objetivo" }).click();
  await expect(page.getByText("0 de 12 livros")).toBeVisible();

  await page.getByLabel("Progresso atual").fill("12");
  await page.getByRole("button", { name: "Salvar progresso" }).click();
  await expect(page.getByText("12 de 12 livros (alcançado)")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Progresso de Ler mais" })).toHaveAttribute("aria-valuenow", "12");
  // A conquista correspondente é desbloqueada por um evento real.
  await expect(page.getByText("Conquista desbloqueada")).toBeVisible();
  const { data } = await adminClient().from("user_achievements").select("code").eq("user_id", user.id);
  expect(data?.map((a) => a.code)).toContain("objetivo_concluido");
});
