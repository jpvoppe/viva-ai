/**
 * Planos e limites do VIVA.
 *
 * ATENÇÃO: os números abaixo são valores INICIAIS de segurança, não uma decisão
 * comercial. Ajuste depois de olhar o custo real por usuário no painel
 * administrativo (/admin → Consumo de IA). Veja docs/CUSTOS.md.
 *
 * Os limites são aplicados no servidor (rotas /api) e contados no banco;
 * a tela apenas mostra o resultado.
 */

export type PlanId = "gratuito" | "plus" | "familia";

export type PlanLimits = {
  /** Mensagens ao assistente por dia. */
  dailyMessages: number;
  /** Gerações nas ferramentas (criar, estudo, planos) por dia. */
  dailyGenerations: number;
  /** Arquivos enviados por dia. */
  dailyFiles: number;
  /** Tamanho máximo de cada arquivo, em bytes. */
  maxFileBytes: number;
  /** Tamanho máximo de uma mensagem, em caracteres. */
  maxInputChars: number;
  /** Teto de tokens de resposta por chamada. */
  maxOutputTokens: number;
  /** Quanto do histórico da conversa vai como contexto, em caracteres. */
  contextChars: number;
  /** Quanto do texto de um anexo vai como contexto, em caracteres. */
  attachmentChars: number;
  /** Itens de memória personalizada. */
  maxMemories: number;
  /** Projetos ativos. */
  maxActiveProjects: number;
  /** Usa o modelo avançado, quando configurado. */
  advancedModel: boolean;
  /** Pode usar pesquisa na web, quando habilitada. */
  webSearch: boolean;
};

export type PlanDefinition = {
  id: PlanId;
  name: string;
  tagline: string;
  limits: PlanLimits;
};

const MB = 1024 * 1024;

export const PLANS: Record<PlanId, PlanDefinition> = {
  gratuito: {
    id: "gratuito",
    name: "Gratuito",
    tagline: "Para conhecer o VIVA e usar no dia a dia.",
    limits: {
      dailyMessages: 15,
      dailyGenerations: 5,
      dailyFiles: 3,
      maxFileBytes: 5 * MB,
      maxInputChars: 4000,
      maxOutputTokens: 1024,
      contextChars: 12000,
      attachmentChars: 20000,
      maxMemories: 10,
      maxActiveProjects: 3,
      advancedModel: false,
      webSearch: false,
    },
  },
  plus: {
    id: "plus",
    name: "VIVA Plus",
    tagline: "Mais mensagens, respostas mais longas e arquivos maiores.",
    limits: {
      dailyMessages: 50,
      dailyGenerations: 60,
      dailyFiles: 30,
      maxFileBytes: 15 * MB,
      maxInputChars: 16000,
      maxOutputTokens: 4096,
      contextChars: 48000,
      attachmentChars: 60000,
      maxMemories: 100,
      maxActiveProjects: 50,
      advancedModel: true,
      webSearch: true,
    },
  },
  familia: {
    id: "familia",
    name: "VIVA Família",
    tagline: "Os limites do Plus para até 5 pessoas, cada uma com seus dados privados.",
    limits: {
      dailyMessages: 50,
      dailyGenerations: 60,
      dailyFiles: 30,
      maxFileBytes: 15 * MB,
      maxInputChars: 16000,
      maxOutputTokens: 4096,
      contextChars: 48000,
      attachmentChars: 60000,
      maxMemories: 100,
      maxActiveProjects: 50,
      advancedModel: true,
      webSearch: true,
    },
  },
};

/** Pessoas em um plano Família, contando o responsável. */
export const FAMILY_MAX_PEOPLE = 5;

export function isPlanId(value: unknown): value is PlanId {
  return value === "gratuito" || value === "plus" || value === "familia";
}

export function getPlan(id: unknown): PlanDefinition {
  return isPlanId(id) ? PLANS[id] : PLANS.gratuito;
}

export type QuotaKind = "mensagem" | "geracao" | "arquivo";

export function quotaLimit(plan: PlanDefinition, kind: QuotaKind): number {
  switch (kind) {
    case "mensagem":
      return plan.limits.dailyMessages;
    case "geracao":
      return plan.limits.dailyGenerations;
    case "arquivo":
      return plan.limits.dailyFiles;
  }
}
