"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  Ellipsis,
  GraduationCap,
  Keyboard,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { useTheme } from "@/components/theme/theme-provider";
import { Dialog } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuLinkItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { Alert, Badge, Progress } from "@/components/ui/feedback";
import { signOutAction } from "@/features/auth/actions";
import { getPlan } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { useApp } from "./app-context";
import { isActive, NAV_ITEMS } from "./nav-items";

const COLLAPSE_KEY = "viva-menu-recolhido";
const collapseListeners = new Set<() => void>();

function subscribeCollapse(callback: () => void) {
  collapseListeners.add(callback);
  return () => {
    collapseListeners.delete(callback);
  };
}
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ctx, aiSimulated, recents } = useApp();
  const collapsed = useSyncExternalStore(subscribeCollapse, readCollapsed, () => false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const onboarding = pathname === "/app/boas-vindas";

  const toggleCollapsed = useCallback(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, readCollapsed() ? "0" : "1");
    } catch {
      // sem armazenamento local: ignora
    }
    for (const listener of collapseListeners) listener();
  }, []);

  // Atalhos de teclado (computador).
  useEffect(() => {
    const pendingG = { current: false };
    function onKeyDown(event: KeyboardEvent) {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        router.push("/app/assistente");
        return;
      }
      if (mod && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleCollapsed();
        return;
      }
      if (isTypingTarget(event.target) || mod || event.altKey) return;
      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      const item = NAV_ITEMS.find((nav) => nav.shortcut === event.key);
      if (item && event.shiftKey === false && pendingG.current) {
        event.preventDefault();
        router.push(item.href);
      }
      pendingG.current = event.key.toLowerCase() === "g";
    }
    window.addEventListener("keydown", onKeyDown);
    // Sinal de que o app está interativo (usado pelos testes automatizados).
    document.documentElement.dataset.appPronto = "1";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      delete document.documentElement.dataset.appPronto;
    };
  }, [router, toggleCollapsed]);

  if (onboarding) {
    return (
      <div className="min-h-dvh">
        <main id="conteudo">{children}</main>
      </div>
    );
  }

  const mobileItems = NAV_ITEMS.filter((item) => item.mobile);
  const moreItems = NAV_ITEMS.filter((item) => !item.mobile);
  const moreActive = moreItems.some((item) => isActive(item, pathname));

  return (
    <div
      className="min-h-dvh lg:pl-[var(--shell-pad)] print:!pl-0"
      style={{ "--shell-pad": collapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w)" } as React.CSSProperties}
    >
      {/* Menu lateral — computador */}
      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface transition-[width] duration-200 ease-out lg:flex",
          collapsed ? "w-[var(--sidebar-w-collapsed)]" : "w-[var(--sidebar-w)]",
        )}
        aria-label="Menu principal"
      >
        <div className={cn("flex h-16 items-center", collapsed ? "justify-center" : "justify-between pl-5 pr-3")}>
          {collapsed ? null : (
            <Link href="/app" aria-label="VIVA AI — Início" className="rounded-md">
              <Logo />
            </Link>
          )}
          <Tooltip content={collapsed ? "Abrir menu (Ctrl+B)" : "Recolher menu (Ctrl+B)"} side="right">
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Abrir menu lateral" : "Recolher menu lateral"}
              aria-expanded={!collapsed}
              className="inline-flex size-10 items-center justify-center rounded-md text-ink-muted hover:bg-sunken hover:text-ink"
            >
              {collapsed ? (
                <PanelLeftOpen aria-hidden="true" className="size-5" />
              ) : (
                <PanelLeftClose aria-hidden="true" className="size-5" />
              )}
            </button>
          </Tooltip>
        </div>

        <div className={cn("px-3", collapsed && "px-2")}>
          <Tooltip content="Nova conversa (Ctrl+K)" side="right">
            <Link
              href="/app/assistente"
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-md bg-violet font-medium text-white shadow-1 transition-colors hover:bg-violet-strong active:scale-[0.98]",
                collapsed ? "justify-center px-0" : "px-3.5",
              )}
            >
              <Plus aria-hidden="true" className="size-5 shrink-0" />
              <span className={cn(collapsed && "sr-only")}>Nova conversa</span>
            </Link>
          </Tooltip>
        </div>

        <nav className={cn("mt-4 flex flex-col gap-0.5 px-3", collapsed && "px-2")} aria-label="Seções">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item, pathname);
            const Icon = item.icon;
            const link = (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 items-center gap-3 rounded-md text-base transition-colors",
                  collapsed ? "justify-center px-0" : "px-3",
                  active ? "font-medium text-ink" : "text-ink-soft hover:bg-sunken hover:text-ink",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="nav-ativo"
                    className="absolute inset-0 rounded-md bg-tint"
                    transition={{ type: "spring", stiffness: 520, damping: 42 }}
                  />
                ) : null}
                <Icon aria-hidden="true" className={cn("relative size-5 shrink-0", active && "text-violet-text")} />
                <span className={cn("relative", collapsed && "sr-only")}>{item.label}</span>
              </Link>
            );
            return collapsed ? (
              <Tooltip key={item.href} content={item.label} side="right">
                {link}
              </Tooltip>
            ) : (
              link
            );
          })}
        </nav>

        {!collapsed && recents.length > 0 ? (
          <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-3 scrollbar-slim">
            <h2 className="px-3 pb-1 font-sans text-sm font-normal tracking-normal text-ink-muted">Conversas recentes</h2>
            <ul>
              {recents.map((conversation) => {
                const href = `/app/assistente/${conversation.id}`;
                const active = pathname === href;
                return (
                  <li key={conversation.id}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block truncate rounded-md px-3 py-2 text-sm",
                        active ? "bg-sunken text-ink" : "text-ink-soft hover:bg-sunken hover:text-ink",
                      )}
                    >
                      {conversation.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className={cn("border-t border-line p-3", collapsed && "p-2")}>
          {!collapsed ? <UsageMeter /> : null}
          <AccountMenu collapsed={collapsed} onShortcuts={() => setShortcutsOpen(true)} />
        </div>
      </aside>

      {/* Barra superior — celular e tablet */}
      <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/90 px-4 pt-safe backdrop-blur-md lg:hidden">
        <Link href="/app" aria-label="VIVA AI — Início" className="rounded-md">
          <Logo size="sm" />
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <AccountMenu collapsed onShortcuts={null} />
        </div>
      </header>

      <main id="conteudo" className="pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px))] lg:pb-0">
        {aiSimulated ? (
          <div className="mx-auto w-full max-w-[var(--content-w)] px-4 pt-4 sm:px-6">
            <Alert tone="atencao" title="Modo de teste: as respostas da IA são simuladas.">
              Nenhum provedor de IA real está em uso neste ambiente.
            </Alert>
          </div>
        ) : null}
        {ctx.subscription.status === "past_due" ? (
          <div className="mx-auto w-full max-w-[var(--content-w)] px-4 pt-4 sm:px-6">
            <Alert
              tone="atencao"
              title="O pagamento da sua assinatura está pendente."
              action={
                <Link href="/app/configuracoes?aba=assinatura" className="font-medium text-violet-text underline underline-offset-4">
                  Atualizar forma de pagamento
                </Link>
              }
            >
              Seu plano continua ativo por enquanto. Atualize o pagamento para não perder os benefícios.
            </Alert>
          </div>
        ) : null}
        {children}
      </main>

      {/* Navegação inferior — celular e tablet */}
      <nav
        aria-label="Seções"
        data-bottom-nav
        className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-safe lg:hidden"
      >
        <ul className="mx-auto grid h-[var(--bottom-nav-h)] max-w-xl grid-cols-5">
          {mobileItems.map((item) => {
            const active = isActive(item, pathname);
            const Icon = item.icon;
            return (
              <li key={item.href} className="contents">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 text-[0.8125rem] leading-tight",
                    active ? "font-medium text-violet-text" : "text-ink-muted",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="nav-inferior-ativo"
                      className="absolute top-0 h-[3px] w-10 rounded-b-full bg-violet"
                      transition={{ type: "spring", stiffness: 520, damping: 42 }}
                    />
                  ) : null}
                  <Icon aria-hidden="true" className="size-[22px]" />
                  <span aria-hidden="true">{item.shortLabel ?? item.label}</span>
                  <span className="sr-only">{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li className="contents">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 text-[0.8125rem] leading-tight",
                moreActive ? "font-medium text-violet-text" : "text-ink-muted",
              )}
            >
              {moreActive ? <span className="absolute top-0 h-[3px] w-10 rounded-b-full bg-violet" /> : null}
              <Ellipsis aria-hidden="true" className="size-[22px]" />
              Mais
            </button>
          </li>
        </ul>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen} title="Mais opções">
        <ul className="flex flex-col">
          {[...moreItems, { href: "/app/aprender", label: "Aprender", icon: GraduationCap }].map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex min-h-12 items-center gap-3 rounded-md px-2 text-base hover:bg-sunken"
                >
                  <Icon aria-hidden="true" className="size-5 text-ink-muted" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 border-t border-line pt-3">
          <UsageMeter />
        </div>
      </Dialog>

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} title="Atalhos de teclado" size="sm">
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2.5">
          {[
            ["Nova conversa", "Ctrl K"],
            ["Recolher ou abrir o menu", "Ctrl B"],
            ["Ir para uma seção", "G depois 1 a 7"],
            ["Enviar mensagem", "Enter"],
            ["Nova linha na mensagem", "Shift Enter"],
            ["Parar a resposta", "Esc"],
            ["Ver estes atalhos", "?"],
          ].map(([label, keys]) => (
            <div key={label} className="contents">
              <dt className="text-ink-soft">{label}</dt>
              <dd>
                <kbd className="rounded-sm border border-line-strong bg-sunken px-2 py-0.5 font-sans text-sm">{keys}</kbd>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-ink-muted">No Mac, use ⌘ no lugar de Ctrl.</p>
      </Dialog>
    </div>
  );
}

function UsageMeter() {
  const { ctx, usage } = useApp();
  const plan = getPlan(ctx.plan);
  const { used, limit } = usage.mensagem;
  const remaining = Math.max(limit - used, 0);
  return (
    <div className="mb-2 rounded-md bg-sunken p-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-ink-soft">Mensagens hoje</span>
        <span className="font-medium tabular-nums text-ink">
          {Math.min(used, limit)} de {limit}
        </span>
      </div>
      <Progress className="mt-2" value={used} max={limit} label="Mensagens usadas hoje" />
      <p className="mt-2 text-sm text-ink-muted">
        {remaining === 0 ? "Limite de hoje atingido. " : null}
        Plano {plan.name}
        {ctx.plan === "gratuito" ? (
          <>
            {". "}
            <Link href="/app/configuracoes?aba=assinatura" className="font-medium text-violet-text underline underline-offset-4">
              Ver planos
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}

function ThemeToggle() {
  const { resolved, setPreference } = useTheme();
  const dark = resolved === "escuro";
  return (
    <button
      type="button"
      onClick={() => setPreference(dark ? "claro" : "escuro")}
      aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
      className="inline-flex size-11 items-center justify-center rounded-md text-ink-muted hover:bg-sunken hover:text-ink"
    >
      <span suppressHydrationWarning className="contents">
        {dark ? <Sun aria-hidden="true" className="size-5" /> : <Moon aria-hidden="true" className="size-5" />}
      </span>
    </button>
  );
}

function AccountMenu({ collapsed, onShortcuts }: { collapsed: boolean; onShortcuts: (() => void) | null }) {
  const { ctx } = useApp();
  const { resolved, setPreference } = useTheme();
  const name = ctx.profile.display_name || "Sua conta";
  const initial = name.trim().charAt(0).toUpperCase() || "V";
  const dark = resolved === "escuro";

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={`Conta de ${name}`}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-md text-left hover:bg-sunken",
            collapsed ? "size-11 justify-center" : "w-full px-2",
          )}
        >
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tint-strong font-display text-sm font-semibold text-violet-text"
          >
            {initial}
          </span>
          {collapsed ? null : (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{name}</span>
              <span className="block truncate text-sm text-ink-muted">{ctx.email}</span>
            </span>
          )}
        </button>
      </MenuTrigger>
      <MenuContent align={collapsed ? "end" : "start"} side={collapsed ? "bottom" : "top"}>
        <MenuLabel>
          <span className="flex items-center justify-between gap-3">
            <span className="truncate">{ctx.email}</span>
            <Badge tone={ctx.plan === "gratuito" ? "neutro" : "marca"}>{getPlan(ctx.plan).name}</Badge>
          </span>
        </MenuLabel>
        <MenuSeparator />
        <MenuLinkItem href="/app/configuracoes" icon={<UserRound />}>
          Conta e configurações
        </MenuLinkItem>
        <MenuItem
          icon={dark ? <Sun /> : <Moon />}
          onSelect={(event) => {
            event.preventDefault();
            setPreference(dark ? "claro" : "escuro");
          }}
        >
          {dark ? "Usar tema claro" : "Usar tema escuro"}
        </MenuItem>
        {onShortcuts ? (
          <MenuItem icon={<Keyboard />} onSelect={onShortcuts}>
            Atalhos de teclado
          </MenuItem>
        ) : null}
        {ctx.profile.role === "admin" ? (
          <MenuLinkItem href="/admin" icon={<ShieldCheck />}>
            Painel administrativo
          </MenuLinkItem>
        ) : null}
        <MenuSeparator />
        <MenuItem icon={<LogOut />} onSelect={() => void signOutAction()}>
          Sair da conta
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
