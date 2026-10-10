import { CalendarCheck, FolderKanban, History, House, MessageCircle, Settings, Sparkles, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  /** Rótulo curto para a barra inferior do celular. */
  shortLabel?: string;
  icon: LucideIcon;
  /** Prefixos de rota que também deixam este item selecionado. */
  match: string[];
  /** Aparece na barra inferior do celular. */
  mobile: boolean;
  shortcut?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Início", icon: House, match: [], mobile: true, shortcut: "1" },
  { href: "/app/assistente", label: "Assistente", icon: MessageCircle, match: ["/app/assistente"], mobile: true, shortcut: "2" },
  { href: "/app/organizador", label: "Organizador", shortLabel: "Organizar", icon: CalendarCheck, match: ["/app/organizador"], mobile: true, shortcut: "3" },
  { href: "/app/criar", label: "Criar", icon: Sparkles, match: ["/app/criar", "/app/aprender"], mobile: false, shortcut: "4" },
  { href: "/app/projetos", label: "Projetos", icon: FolderKanban, match: ["/app/projetos"], mobile: true, shortcut: "5" },
  { href: "/app/historico", label: "Histórico", icon: History, match: ["/app/historico"], mobile: false, shortcut: "6" },
  { href: "/app/configuracoes", label: "Configurações", icon: Settings, match: ["/app/configuracoes"], mobile: false, shortcut: "7" },
];

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/app") return pathname === "/app";
  return item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
