/**
 * Conversor de unidades — cálculo exato em código, sem IA.
 * Cada unidade tem um fator para a unidade-base da categoria
 * (temperatura é tratada à parte, porque não é só multiplicação).
 */

export type UnitCategoryId = "comprimento" | "massa" | "volume" | "temperatura" | "area" | "tempo" | "velocidade";

export type Unit = { id: string; label: string; factor: number };
export type UnitCategory = { id: UnitCategoryId; label: string; units: Unit[] };

export const UNIT_CATEGORIES: UnitCategory[] = [
  {
    id: "comprimento",
    label: "Comprimento",
    units: [
      { id: "mm", label: "milímetro (mm)", factor: 0.001 },
      { id: "cm", label: "centímetro (cm)", factor: 0.01 },
      { id: "m", label: "metro (m)", factor: 1 },
      { id: "km", label: "quilômetro (km)", factor: 1000 },
      { id: "in", label: "polegada (in)", factor: 0.0254 },
      { id: "ft", label: "pé (ft)", factor: 0.3048 },
      { id: "yd", label: "jarda (yd)", factor: 0.9144 },
      { id: "mi", label: "milha (mi)", factor: 1609.344 },
    ],
  },
  {
    id: "massa",
    label: "Peso (massa)",
    units: [
      { id: "mg", label: "miligrama (mg)", factor: 0.000001 },
      { id: "g", label: "grama (g)", factor: 0.001 },
      { id: "kg", label: "quilograma (kg)", factor: 1 },
      { id: "t", label: "tonelada (t)", factor: 1000 },
      { id: "oz", label: "onça (oz)", factor: 0.028349523125 },
      { id: "lb", label: "libra (lb)", factor: 0.45359237 },
      { id: "arroba", label: "arroba (15 kg)", factor: 15 },
    ],
  },
  {
    id: "volume",
    label: "Volume",
    units: [
      { id: "ml", label: "mililitro (ml)", factor: 0.001 },
      { id: "l", label: "litro (L)", factor: 1 },
      { id: "m3", label: "metro cúbico (m³)", factor: 1000 },
      { id: "colher_cha", label: "colher de chá (5 ml)", factor: 0.005 },
      { id: "colher_sopa", label: "colher de sopa (15 ml)", factor: 0.015 },
      { id: "xicara", label: "xícara de chá (240 ml)", factor: 0.24 },
      { id: "floz", label: "onça líquida americana (fl oz)", factor: 0.0295735295625 },
      { id: "gal", label: "galão americano (gal)", factor: 3.785411784 },
    ],
  },
  {
    id: "temperatura",
    label: "Temperatura",
    units: [
      { id: "c", label: "Celsius (°C)", factor: 1 },
      { id: "f", label: "Fahrenheit (°F)", factor: 1 },
      { id: "k", label: "Kelvin (K)", factor: 1 },
    ],
  },
  {
    id: "area",
    label: "Área",
    units: [
      { id: "cm2", label: "centímetro quadrado (cm²)", factor: 0.0001 },
      { id: "m2", label: "metro quadrado (m²)", factor: 1 },
      { id: "km2", label: "quilômetro quadrado (km²)", factor: 1_000_000 },
      { id: "ha", label: "hectare (ha)", factor: 10_000 },
      { id: "alqueire_sp", label: "alqueire paulista (24.200 m²)", factor: 24_200 },
      { id: "ft2", label: "pé quadrado (ft²)", factor: 0.09290304 },
      { id: "acre", label: "acre", factor: 4046.8564224 },
    ],
  },
  {
    id: "tempo",
    label: "Tempo",
    units: [
      { id: "s", label: "segundo", factor: 1 },
      { id: "min", label: "minuto", factor: 60 },
      { id: "h", label: "hora", factor: 3600 },
      { id: "d", label: "dia", factor: 86_400 },
      { id: "sem", label: "semana", factor: 604_800 },
    ],
  },
  {
    id: "velocidade",
    label: "Velocidade",
    units: [
      { id: "ms", label: "metro por segundo (m/s)", factor: 1 },
      { id: "kmh", label: "quilômetro por hora (km/h)", factor: 1 / 3.6 },
      { id: "mph", label: "milha por hora (mph)", factor: 0.44704 },
      { id: "kn", label: "nó (kn)", factor: 0.514444444444 },
    ],
  },
];

function toCelsius(value: number, unit: string): number {
  if (unit === "f") return ((value - 32) * 5) / 9;
  if (unit === "k") return value - 273.15;
  return value;
}

function fromCelsius(value: number, unit: string): number {
  if (unit === "f") return (value * 9) / 5 + 32;
  if (unit === "k") return value + 273.15;
  return value;
}

/** Converte um valor entre duas unidades da mesma categoria. Devolve null se a entrada for inválida. */
export function convertUnit(categoryId: UnitCategoryId, value: number, fromId: string, toId: string): number | null {
  if (!Number.isFinite(value)) return null;
  const category = UNIT_CATEGORIES.find((c) => c.id === categoryId);
  if (!category) return null;
  const from = category.units.find((u) => u.id === fromId);
  const to = category.units.find((u) => u.id === toId);
  if (!from || !to) return null;
  if (categoryId === "temperatura") return fromCelsius(toCelsius(value, from.id), to.id);
  return (value * from.factor) / to.factor;
}

/** Formata o resultado com até 6 casas significativas, no padrão brasileiro. */
export function formatConverted(value: number): string {
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1e15 || abs < 1e-9) return value.toExponential(4).replace(".", ",");
  const rounded = Number(value.toPrecision(8));
  return rounded.toLocaleString("pt-BR", { maximumFractionDigits: abs < 1 ? 9 : 6 });
}

/** Aceita número digitado com vírgula ou ponto ("1,5" ou "1.5"; "1.234,5"). */
export function parseLocaleNumber(text: string): number | null {
  const trimmed = text.trim().replace(/\s/g, "");
  if (!trimmed) return null;
  let normalized = trimmed;
  if (trimmed.includes(",")) normalized = trimmed.replace(/\./g, "").replace(",", ".");
  if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
