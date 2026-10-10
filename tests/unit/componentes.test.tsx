import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, IconButton } from "@/components/ui/button";
import { Field, fieldAria, Input } from "@/components/ui/field";
import { Alert, EmptyState, Progress } from "@/components/ui/feedback";
import { Orb } from "@/components/orb/orb";
import { PlanTable } from "@/components/plans/plan-table";
import { PLANS } from "@/lib/plans";

describe("Button", () => {
  it("dispara a ação ao clicar e pelo teclado", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Salvar projeto</Button>);
    const button = screen.getByRole("button", { name: "Salvar projeto" });
    await userEvent.click(button);
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("carregando: fica desabilitado, avisa leitores de tela e não dispara de novo", async () => {
    const onClick = vi.fn();
    render(
      <Button loading loadingLabel="Salvando" onClick={onClick}>
        Salvar projeto
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Salvando")).toBeInTheDocument();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("não envia formulário por acidente (type=button por padrão)", () => {
    render(<Button>Cancelar</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("botão só com ícone tem nome acessível", () => {
    render(
      <IconButton label="Excluir tarefa">
        <svg />
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Excluir tarefa" })).toBeInTheDocument();
  });
});

describe("Field", () => {
  it("liga rótulo, ajuda e erro ao campo", () => {
    const { rerender } = render(
      <Field id="email" label="E-mail" hint="Usamos para o login.">
        <Input {...fieldAria("email", null, true)} />
      </Field>,
    );
    const input = screen.getByLabelText("E-mail");
    expect(input).toHaveAttribute("aria-describedby", "email-ajuda");
    expect(input).not.toHaveAttribute("aria-invalid");

    rerender(
      <Field id="email" label="E-mail" hint="Usamos para o login." error="Informe o seu e-mail.">
        <Input {...fieldAria("email", "Informe o seu e-mail.", true)} />
      </Field>,
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "email-erro");
    expect(screen.getByRole("alert")).toHaveTextContent("Informe o seu e-mail.");
    expect(screen.queryByText("Usamos para o login.")).not.toBeInTheDocument();
  });
});

describe("avisos e estados", () => {
  it("o alerta de erro é anunciado e traz o tipo em texto (não só cor)", () => {
    render(<Alert tone="erro" title="Não foi possível salvar." />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Erro:");
    expect(alert).toHaveTextContent("Não foi possível salvar.");
  });

  it("a barra de progresso informa o valor e nunca passa de 100%", () => {
    render(<Progress value={30} max={20} label="Mensagens usadas hoje" />);
    const bar = screen.getByRole("progressbar", { name: "Mensagens usadas hoje" });
    expect(bar).toHaveAttribute("aria-valuenow", "20");
    expect(bar).toHaveAttribute("aria-valuemax", "20");
  });

  it("estado vazio mostra título, explicação e ação", () => {
    render(
      <EmptyState title="Nenhuma tarefa" action={<Button>Criar tarefa</Button>}>
        Escreva a primeira.
      </EmptyState>,
    );
    expect(screen.getByRole("heading", { name: "Nenhuma tarefa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar tarefa" })).toBeInTheDocument();
  });
});

describe("Pulso", () => {
  it("decorativo por padrão; quando não é, descreve o estado real", () => {
    const { container, rerender } = render(<Orb state="pensando" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.firstElementChild).toHaveAttribute("data-state", "pensando");
    rerender(<Orb state="pesquisando" decorative={false} />);
    expect(screen.getByRole("img", { name: "Pesquisando" })).toBeInTheDocument();
  });
});

describe("tabela de planos", () => {
  it("mostra os limites reais de plans.ts e não inventa preço", () => {
    render(<PlanTable prices={{ plus: null, familia: "R$ 49,90 por mês" }} current="gratuito" />);
    expect(screen.getByText(`${PLANS.gratuito.limits.dailyMessages} mensagens ao assistente por dia`)).toBeInTheDocument();
    expect(screen.getAllByText(`${PLANS.plus.limits.dailyMessages} mensagens ao assistente por dia`).length).toBeGreaterThan(0);
    expect(screen.getByText("Preço a definir")).toBeInTheDocument();
    expect(screen.getByText("R$ 49,90 por mês")).toBeInTheDocument();
    expect(screen.getByText("Seu plano")).toBeInTheDocument();
  });
});
