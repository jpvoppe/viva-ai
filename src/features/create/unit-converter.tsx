"use client";

import { useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/field";
import { convertUnit, formatConverted, parseLocaleNumber, UNIT_CATEGORIES, type UnitCategoryId } from "@/lib/units";

export function UnitConverter() {
  const [categoryId, setCategoryId] = useState<UnitCategoryId>("comprimento");
  const category = UNIT_CATEGORIES.find((c) => c.id === categoryId) ?? UNIT_CATEGORIES[0];
  const [fromId, setFromId] = useState("m");
  const [toId, setToId] = useState("cm");
  const [input, setInput] = useState("1");

  const value = parseLocaleNumber(input);
  const result = value === null ? null : convertUnit(category.id, value, fromId, toId);
  const fromUnit = category.units.find((u) => u.id === fromId);
  const toUnit = category.units.find((u) => u.id === toId);
  const invalid = input.trim() !== "" && value === null;

  const changeCategory = (id: UnitCategoryId) => {
    const next = UNIT_CATEGORIES.find((c) => c.id === id) ?? UNIT_CATEGORIES[0];
    setCategoryId(next.id);
    setFromId(next.units[0].id);
    setToId(next.units[1].id);
  };

  return (
    <div className="flex flex-col gap-5">
      <Field id="categoria" label="O que você quer converter?">
        <Select id="categoria" value={category.id} onChange={(event) => changeCategory(event.target.value as UnitCategoryId)}>
          {UNIT_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <div className="flex flex-col gap-3">
          <Field id="valor" label="Valor" error={invalid ? "Digite um número, por exemplo 2,5." : null}>
            <Input
              id="valor"
              inputMode="decimal"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              aria-invalid={invalid || undefined}
              autoComplete="off"
            />
          </Field>
          <Field id="de" label="De">
            <Select id="de" value={fromId} onChange={(event) => setFromId(event.target.value)}>
              {category.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <button
          type="button"
          onClick={() => {
            setFromId(toId);
            setToId(fromId);
          }}
          aria-label="Inverter as unidades"
          className="mx-auto inline-flex size-11 items-center justify-center rounded-full border border-line-strong text-ink-soft hover:bg-sunken sm:mb-0.5"
        >
          <ArrowUpDown aria-hidden="true" className="size-5 sm:rotate-90" />
        </button>

        <Field id="para" label="Para">
          <Select id="para" value={toId} onChange={(event) => setToId(event.target.value)}>
            {category.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="rounded-lg bg-tint p-5" role="status" aria-live="polite">
        <p className="text-sm text-ink-soft">Resultado</p>
        {result === null ? (
          <p className="mt-1 text-ink-muted">Digite um valor para converter.</p>
        ) : (
          <p className="mt-1 break-words font-display text-3xl font-semibold tabular-nums">
            {formatConverted(result)}{" "}
            <span className="text-lg font-normal text-ink-soft">{toUnit?.label}</span>
          </p>
        )}
        {result !== null && value !== null ? (
          <p className="mt-1 text-sm text-ink-muted">
            {formatConverted(value)} {fromUnit?.label} equivale a {formatConverted(result)} {toUnit?.label}.
          </p>
        ) : null}
      </div>
      <p className="text-sm text-ink-muted">
        Cálculo feito no seu aparelho, sem IA e sem gastar criações. Medidas de cozinha (xícara e colheres) seguem o
        padrão de 240 ml, 15 ml e 5 ml.
      </p>
    </div>
  );
}
