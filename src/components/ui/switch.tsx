"use client";

import { Switch as RadixSwitch } from "radix-ui";
import type { ReactNode } from "react";

export function Switch({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  label: string;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer font-medium text-ink">
          {label}
        </label>
        {description ? (
          <p id={`${id}-desc`} className="mt-0.5 text-sm text-ink-muted">
            {description}
          </p>
        ) : null}
      </div>
      <RadixSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={description ? `${id}-desc` : undefined}
        className="relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full bg-line-strong transition-colors data-[state=checked]:bg-violet disabled:opacity-50"
      >
        <RadixSwitch.Thumb className="block size-5 translate-x-1 rounded-full bg-white shadow-1 transition-transform duration-200 ease-out data-[state=checked]:translate-x-6" />
        <span className="sr-only">{checked ? "Ativado" : "Desativado"}</span>
      </RadixSwitch.Root>
    </div>
  );
}
