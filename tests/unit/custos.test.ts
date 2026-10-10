// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("custo estimado de IA", () => {
  it("calcula em milionésimos de dólar a partir do preço por milhão de tokens", async () => {
    const { estimateCostMicroUsd } = await import("@/lib/ai/pricing");
    // Haiku 4.5: US$ 1 / milhão (entrada) e US$ 5 / milhão (saída)
    expect(estimateCostMicroUsd("claude-haiku-4-5-20251001", 1_000_000, 0)).toBe(1_000_000);
    expect(estimateCostMicroUsd("claude-haiku-4-5-20251001", 3000, 700)).toBe(3000 + 3500);
  });

  it("modelo sem preço conhecido devolve nulo, nunca um número inventado", async () => {
    const { estimateCostMicroUsd } = await import("@/lib/ai/pricing");
    expect(estimateCostMicroUsd("modelo-desconhecido", 1000, 1000)).toBeNull();
  });

  it("aceita tabela de preços por variável de ambiente e ignora JSON inválido", async () => {
    vi.stubEnv("AI_PRECOS_JSON", '{"meu-modelo":{"entrada":0.5,"saida":1.5},"quebrado":{"entrada":"x"}}');
    const first = await import("@/lib/ai/pricing");
    expect(first.estimateCostMicroUsd("meu-modelo", 2_000_000, 1_000_000)).toBe(2_500_000);
    expect(first.estimateCostMicroUsd("quebrado", 1, 1)).toBeNull();

    vi.resetModules();
    vi.stubEnv("AI_PRECOS_JSON", "{isso não é json");
    const second = await import("@/lib/ai/pricing");
    expect(second.estimateCostMicroUsd("claude-haiku-4-5-20251001", 1_000_000, 0)).toBe(1_000_000);
  });
});

describe("escolha do provedor de IA", () => {
  it("sem credencial: não configurada (o app avisa e não inventa resposta)", async () => {
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENAI_COMPAT_API_KEY", "");
    const { getAiSetup } = await import("@/lib/ai");
    expect(getAiSetup().configured).toBe(false);
  });

  it("IA simulada só liga com a permissão explícita e nunca em produção", async () => {
    vi.stubEnv("AI_PROVIDER", "simulada");
    vi.stubEnv("VIVA_PERMITIR_IA_SIMULADA", "");
    let mod = await import("@/lib/ai");
    expect(mod.getAiSetup().configured).toBe(false);

    vi.resetModules();
    vi.stubEnv("VIVA_PERMITIR_IA_SIMULADA", "1");
    vi.stubEnv("VERCEL_ENV", "production");
    mod = await import("@/lib/ai");
    expect(mod.getAiSetup().configured).toBe(false);

    vi.resetModules();
    vi.stubEnv("VERCEL_ENV", "preview");
    mod = await import("@/lib/ai");
    const setup = mod.getAiSetup();
    expect(setup.configured && setup.simulated).toBe(true);
  });

  it("modelo avançado só para planos que têm direito e quando configurado", async () => {
    vi.stubEnv("AI_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "chave");
    vi.stubEnv("AI_MODEL_AVANCADO", "modelo-grande");
    const { getAiSetup, modelForPlan, modelForStructured, DEFAULT_ANTHROPIC_MODEL } = await import("@/lib/ai");
    const setup = getAiSetup();
    if (!setup.configured) throw new Error("deveria estar configurada");
    expect(modelForPlan(setup, "gratuito")).toBe(DEFAULT_ANTHROPIC_MODEL);
    expect(modelForPlan(setup, "plus")).toBe("modelo-grande");
    expect(modelForStructured(setup)).toBe(DEFAULT_ANTHROPIC_MODEL);
  });

  it("provedor compatível exige chave, endereço e modelo", async () => {
    vi.stubEnv("AI_PROVIDER", "openai-compat");
    vi.stubEnv("OPENAI_COMPAT_API_KEY", "k");
    vi.stubEnv("OPENAI_COMPAT_BASE_URL", "");
    const { getAiSetup } = await import("@/lib/ai");
    expect(getAiSetup().configured).toBe(false);
  });
});
