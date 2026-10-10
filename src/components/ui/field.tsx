import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const controlBase =
  "w-full min-w-0 rounded-md border border-line-strong bg-surface text-ink placeholder:text-ink-muted " +
  "transition-[border-color,box-shadow] duration-150 " +
  "hover:border-ink-muted focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/25 " +
  "disabled:opacity-60 disabled:cursor-not-allowed " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/25";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlBase, "min-h-11 px-3.5 py-2", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlBase, "min-h-24 px-3.5 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <span className="relative block">
      <select className={cn(controlBase, "min-h-11 appearance-none py-2 pl-3.5 pr-10", className)} {...props}>
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m5 7.5 5 5 5-5" />
      </svg>
    </span>
  );
}

/**
 * Campo de formulário completo: rótulo, ajuda e erro ligados ao controle
 * por id, para leitores de tela. O erro tem ícone e texto (não só cor).
 */
export function Field({
  id,
  label,
  hint,
  error,
  optional,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {optional ? <span className="font-normal text-ink-muted"> (opcional)</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-ajuda`} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-erro`} role="alert" className="flex items-start gap-1.5 text-sm text-danger">
          <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 size-4 shrink-0" fill="currentColor">
            <path d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm-.75 4.75a.75.75 0 0 1 1.5 0v4.5a.75.75 0 0 1-1.5 0v-4.5ZM10 14.75a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
          </svg>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

/** Atributos de acessibilidade para ligar o controle ao erro/ajuda do Field. */
export function fieldAria(id: string, error?: string | null, hasHint?: boolean) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-erro` : hasHint ? `${id}-ajuda` : undefined,
  } as const;
}

export function Checkbox({
  id,
  label,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { id: string; label: ReactNode }) {
  return (
    <label htmlFor={id} className={cn("flex min-h-11 cursor-pointer items-start gap-3 py-2 text-base text-ink", className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 rounded-[6px] border border-line-strong accent-violet"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
