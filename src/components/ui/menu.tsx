"use client";

import { DropdownMenu } from "radix-ui";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({
  className,
  children,
  align = "end",
  ...props
}: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        collisionPadding={12}
        className={cn(
          "z-50 min-w-52 max-w-[min(20rem,calc(100vw-1.5rem))] rounded-md border border-line bg-raised p-1.5 text-ink shadow-3",
          "origin-[var(--radix-dropdown-menu-content-transform-origin)] data-[state=open]:animate-pop",
          className,
        )}
        {...props}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function MenuItem({
  className,
  danger,
  icon,
  children,
  ...props
}: ComponentProps<typeof DropdownMenu.Item> & { danger?: boolean; icon?: ReactNode }) {
  return (
    <DropdownMenu.Item
      className={cn(
        "flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-sm px-3 text-base outline-none",
        "data-[highlighted]:bg-sunken data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        danger ? "text-danger" : "text-ink",
        className,
      )}
      {...props}
    >
      {icon ? <span aria-hidden="true" className="flex size-5 items-center justify-center [&>svg]:size-[18px]">{icon}</span> : null}
      {children}
    </DropdownMenu.Item>
  );
}

/** Item de menu que navega para outra página. */
export function MenuLinkItem({ href, icon, children }: { href: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <DropdownMenu.Item asChild>
      <Link
        href={href}
        className="flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-sm px-3 text-base text-ink outline-none data-[highlighted]:bg-sunken"
      >
        {icon ? <span aria-hidden="true" className="flex size-5 items-center justify-center [&>svg]:size-[18px]">{icon}</span> : null}
        {children}
      </Link>
    </DropdownMenu.Item>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <DropdownMenu.Label className="px-3 pb-1 pt-2 text-sm text-ink-muted">{children}</DropdownMenu.Label>;
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1.5 h-px bg-line" />;
}
