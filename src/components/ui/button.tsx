import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "relative inline-flex items-center justify-center gap-2 font-medium select-none " +
  "rounded-md transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55";

const variants: Record<Variant, string> = {
  primary:
    "bg-violet text-ink-inverse shadow-1 hover:bg-violet-strong hover:shadow-2 " +
    "shadow-[inset_0_1px_0_rgb(255_255_255/0.22),var(--elev-1)]",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-sunken hover:border-ink-muted",
  ghost: "text-ink-soft hover:bg-sunken hover:text-ink",
  danger: "bg-danger-strong text-white hover:brightness-110 dark:bg-danger-strong",
  link: "text-violet-text underline underline-offset-4 decoration-1 hover:decoration-2 active:scale-100 rounded-sm text-left",
};

const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-base",
  lg: "min-h-12 px-6 text-base",
  icon: "size-11 shrink-0",
};

export type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Texto lido por leitores de tela enquanto carrega. */
  loadingLabel?: string;
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], variant === "link" ? "min-h-0 px-0" : `whitespace-nowrap ${sizes[size]}`, className);
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel = "Carregando",
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Spinner className="size-4" />
          <span className="sr-only">{loadingLabel}</span>
          <span aria-hidden="true">{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, "className"> & {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}

/** Botão só com ícone: o rótulo é obrigatório para acessibilidade. */
export function IconButton({
  label,
  className,
  children,
  variant = "ghost",
  ...props
}: Omit<ButtonProps, "size" | "aria-label"> & { label: string }) {
  return (
    <Button variant={variant} size="icon" aria-label={label} title={label} className={className} {...props}>
      {children}
    </Button>
  );
}
