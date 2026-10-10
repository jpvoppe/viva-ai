import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "sucesso" | "atencao" | "erro";

const toneStyles: Record<Tone, string> = {
  info: "bg-info-bg text-ink border-info/30",
  sucesso: "bg-success-bg text-ink border-success/30",
  atencao: "bg-warning-bg text-ink border-warning/35",
  erro: "bg-danger-bg text-ink border-danger/35",
};
const toneIcon: Record<Tone, string> = {
  info: "text-info",
  sucesso: "text-success",
  atencao: "text-warning",
  erro: "text-danger",
};
const toneLabel: Record<Tone, string> = {
  info: "Informação",
  sucesso: "Sucesso",
  atencao: "Atenção",
  erro: "Erro",
};
const ICON = { info: Info, sucesso: CircleCheck, atencao: TriangleAlert, erro: CircleAlert } as const;

/** Aviso fixo na página. Tem ícone e rótulo de texto: não depende só da cor. */
export function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const Icon = ICON[tone];
  return (
    <div
      role={tone === "erro" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-md border p-4", toneStyles[tone], className)}
    >
      <Icon aria-hidden="true" className={cn("mt-0.5 size-5 shrink-0", toneIcon[tone])} />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          <span className="sr-only">{toneLabel[tone]}: </span>
          {title}
        </p>
        {children ? <div className={cn("text-ink-soft", title && "mt-0.5")}>{children}</div> : null}
        {action ? <div className="mt-3 flex flex-wrap gap-2">{action}</div> : null}
      </div>
    </div>
  );
}

export function Badge({
  tone = "neutro",
  children,
  className,
}: {
  tone?: "neutro" | "marca" | "sucesso" | "atencao" | "erro";
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium",
        tone === "neutro" && "bg-sunken text-ink-soft",
        tone === "marca" && "bg-tint text-violet-text",
        tone === "sucesso" && "bg-success-bg text-success",
        tone === "atencao" && "bg-warning-bg text-warning",
        tone === "erro" && "bg-danger-bg text-danger",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-skeleton rounded-md bg-sunken", className)} />;
}

/** Tela sem dados: explica o que é o espaço e convida para a primeira ação. */
export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-3 rounded-lg border border-dashed border-line-strong p-6 sm:p-8", className)}>
      {icon ? (
        <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-md bg-tint text-violet-text [&>svg]:size-5">
          {icon}
        </span>
      ) : null}
      <div>
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        {children ? <p className="mt-1 max-w-prose text-ink-soft">{children}</p> : null}
      </div>
      {action ? <div className="mt-1 flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

/** Barra de progresso com valor lido por leitores de tela. */
export function Progress({
  value,
  max = 100,
  label,
  className,
}: {
  value: number;
  max?: number;
  label: string;
  className?: string;
}) {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.min(100, Math.max(0, (value / safeMax) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={Math.min(value, safeMax)}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-sunken", className)}
    >
      <div
        className="h-full origin-left rounded-full bg-brand-gradient transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
