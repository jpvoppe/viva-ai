/** Custo em dólares a partir de milionésimos de dólar. Usado no servidor e no navegador. */
export function formatUsd(microUsd: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(
    microUsd / 1_000_000,
  );
}
