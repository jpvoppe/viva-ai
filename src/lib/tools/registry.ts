/**
 * Catálogo das ferramentas de criação do VIVA.
 * Cada ferramenta é só uma descrição: campos do formulário + instruções para a IA.
 * Para criar uma ferramenta nova, basta acrescentar um item aqui.
 */

export type ToolGroup = "conteudo" | "estudo" | "dia_a_dia";

export type ToolField =
  | {
      type: "text" | "textarea";
      name: string;
      label: string;
      placeholder?: string;
      required?: boolean;
      maxLength: number;
      hint?: string;
    }
  | { type: "select"; name: string; label: string; options: { value: string; label: string }[]; hint?: string }
  | { type: "checkbox"; name: string; label: string };

export type ToolValues = Record<string, string | boolean>;

export type ToolDefinition = {
  id: string;
  group: ToolGroup;
  title: string;
  description: string;
  /** Nome do ícone (mapeado na interface). */
  icon: string;
  /** Rótulo do botão principal: diz exatamente o que acontece. */
  action: string;
  fields: ToolField[];
  /** Instrução específica desta ferramenta (somada às regras gerais do VIVA). */
  instruction: string;
  /** Monta o pedido a partir do formulário já validado. */
  buildPrompt: (values: ToolValues) => string;
  /** A resposta costuma ser uma lista que pode virar lista no Organizador. */
  listable?: boolean;
  /** Título sugerido para salvar. */
  titleFrom: string;
};

export const TOOL_GROUPS: { id: ToolGroup; title: string; description: string }[] = [
  { id: "conteudo", title: "Conteúdo", description: "Textos prontos para revisar e usar." },
  { id: "estudo", title: "Estudo", description: "Entender, resumir e planejar o aprendizado." },
  { id: "dia_a_dia", title: "Dia a dia", description: "Planejamentos práticos para a vida real." },
];

const TONE = {
  type: "select" as const,
  name: "tom",
  label: "Tom",
  options: [
    { value: "amigável", label: "Amigável" },
    { value: "profissional", label: "Profissional" },
    { value: "formal", label: "Formal" },
    { value: "descontraído", label: "Descontraído" },
    { value: "persuasivo", label: "Persuasivo" },
  ],
};

const SIZE = {
  type: "select" as const,
  name: "tamanho",
  label: "Tamanho",
  options: [
    { value: "curto", label: "Curto" },
    { value: "médio", label: "Médio" },
    { value: "longo", label: "Longo" },
  ],
};

const LEVEL = {
  type: "select" as const,
  name: "nivel",
  label: "Seu nível no assunto",
  options: [
    { value: "iniciante", label: "Iniciante" },
    { value: "intermediário", label: "Intermediário" },
    { value: "avançado", label: "Avançado" },
  ],
};

const v = (values: ToolValues, name: string): string => {
  const value = values[name];
  return typeof value === "string" ? value.trim() : "";
};
const line = (label: string, value: string): string => (value ? `${label}: ${value}\n` : "");

export const TOOLS: ToolDefinition[] = [
  // --- Conteúdo ---------------------------------------------------------------
  {
    id: "mensagem",
    group: "conteudo",
    title: "Rascunho de mensagem",
    description: "E-mail, WhatsApp ou recado: você diz o que quer comunicar.",
    icon: "mail",
    action: "Escrever rascunho",
    titleFrom: "objetivo",
    fields: [
      { type: "textarea", name: "objetivo", label: "O que você quer dizer?", placeholder: "Ex.: avisar o cliente que a entrega vai atrasar dois dias", required: true, maxLength: 1500 },
      { type: "text", name: "destinatario", label: "Para quem é?", placeholder: "Ex.: cliente, chefe, grupo da família", maxLength: 120 },
      TONE,
      SIZE,
    ],
    instruction:
      "Escreva um rascunho de mensagem pronto para enviar. Não invente fatos, nomes, datas ou valores que o usuário não informou: use [colchetes] para o que faltar. Entregue só a mensagem, sem comentários antes ou depois.",
    buildPrompt: (x) =>
      `Escreva uma mensagem.\n${line("O que comunicar", v(x, "objetivo"))}${line("Destinatário", v(x, "destinatario"))}${line("Tom", v(x, "tom"))}${line("Tamanho", v(x, "tamanho"))}`,
  },
  {
    id: "legenda",
    group: "conteudo",
    title: "Legenda para rede social",
    description: "Três opções de legenda para o seu post.",
    icon: "hash",
    action: "Criar legendas",
    titleFrom: "assunto",
    fields: [
      { type: "textarea", name: "assunto", label: "Sobre o que é o post?", required: true, maxLength: 1000 },
      {
        type: "select",
        name: "rede",
        label: "Rede social",
        options: ["Instagram", "TikTok", "LinkedIn", "Facebook", "X"].map((n) => ({ value: n, label: n })),
      },
      TONE,
      { type: "checkbox", name: "hashtags", label: "Incluir hashtags" },
    ],
    instruction:
      "Crie 3 opções de legenda, numeradas, adequadas à rede social indicada. Não invente dados sobre o produto, pessoa ou evento.",
    buildPrompt: (x) =>
      `Crie legendas.\n${line("Assunto", v(x, "assunto"))}${line("Rede", v(x, "rede"))}${line("Tom", v(x, "tom"))}Hashtags: ${x.hashtags ? "sim, de 3 a 6 por opção" : "não"}\n`,
  },
  {
    id: "ideias-video",
    group: "conteudo",
    title: "Ideias para vídeos",
    description: "Dez ideias com gancho inicial para o seu tema.",
    icon: "clapperboard",
    action: "Gerar ideias",
    titleFrom: "tema",
    listable: true,
    fields: [
      { type: "text", name: "tema", label: "Tema ou nicho", required: true, maxLength: 300 },
      { type: "text", name: "publico", label: "Para quem são os vídeos?", maxLength: 200 },
      {
        type: "select",
        name: "formato",
        label: "Formato",
        options: [
          { value: "vídeos curtos (até 1 minuto)", label: "Vídeos curtos" },
          { value: "vídeos longos (5 a 15 minutos)", label: "Vídeos longos" },
        ],
      },
    ],
    instruction:
      "Liste 10 ideias de vídeo em lista com marcadores. Cada item: título em negrito e, na mesma linha, o gancho dos primeiros segundos.",
    buildPrompt: (x) =>
      `Gere ideias de vídeo.\n${line("Tema", v(x, "tema"))}${line("Público", v(x, "publico"))}${line("Formato", v(x, "formato"))}`,
  },
  {
    id: "roteiro",
    group: "conteudo",
    title: "Roteiro",
    description: "Roteiro com abertura, desenvolvimento e encerramento.",
    icon: "scroll",
    action: "Escrever roteiro",
    titleFrom: "tema",
    fields: [
      { type: "textarea", name: "tema", label: "Sobre o que é o vídeo ou a fala?", required: true, maxLength: 1500 },
      {
        type: "select",
        name: "duracao",
        label: "Duração",
        options: [
          { value: "até 1 minuto", label: "Até 1 minuto" },
          { value: "cerca de 3 minutos", label: "Cerca de 3 minutos" },
          { value: "cerca de 10 minutos", label: "Cerca de 10 minutos" },
        ],
      },
      TONE,
    ],
    instruction:
      "Escreva um roteiro dividido em: Gancho, Desenvolvimento (em blocos com falas sugeridas) e Encerramento com chamada para ação. Respeite a duração pedida.",
    buildPrompt: (x) =>
      `Escreva um roteiro.\n${line("Tema", v(x, "tema"))}${line("Duração", v(x, "duracao"))}${line("Tom", v(x, "tom"))}`,
  },
  {
    id: "descricao-produto",
    group: "conteudo",
    title: "Descrição de produto",
    description: "Texto de venda a partir das características que você informar.",
    icon: "tag",
    action: "Escrever descrição",
    titleFrom: "produto",
    fields: [
      { type: "text", name: "produto", label: "Produto", required: true, maxLength: 200 },
      { type: "textarea", name: "caracteristicas", label: "Características e diferenciais", required: true, maxLength: 2000, hint: "A descrição usa só o que você escrever aqui." },
      { type: "text", name: "publico", label: "Para quem é?", maxLength: 200 },
      TONE,
    ],
    instruction:
      "Escreva uma descrição de produto com: título, um parágrafo de apresentação e uma lista de benefícios. Use SOMENTE as características informadas; não invente especificações, garantias, preços ou resultados.",
    buildPrompt: (x) =>
      `Escreva a descrição de um produto.\n${line("Produto", v(x, "produto"))}${line("Características", v(x, "caracteristicas"))}${line("Público", v(x, "publico"))}${line("Tom", v(x, "tom"))}`,
  },
  {
    id: "convite",
    group: "conteudo",
    title: "Convite",
    description: "Texto de convite para festa, reunião ou evento.",
    icon: "party",
    action: "Escrever convite",
    titleFrom: "evento",
    fields: [
      { type: "text", name: "evento", label: "Qual é o evento?", required: true, maxLength: 200 },
      { type: "text", name: "quando_onde", label: "Data, horário e local", maxLength: 300 },
      { type: "textarea", name: "detalhes", label: "Outros detalhes", maxLength: 800 },
      TONE,
    ],
    instruction:
      "Escreva um convite pronto para enviar. Se faltar data, horário ou local, deixe [colchetes] para preencher. Entregue só o convite.",
    buildPrompt: (x) =>
      `Escreva um convite.\n${line("Evento", v(x, "evento"))}${line("Quando e onde", v(x, "quando_onde"))}${line("Detalhes", v(x, "detalhes"))}${line("Tom", v(x, "tom"))}`,
  },
  {
    id: "apresentacao",
    group: "conteudo",
    title: "Estrutura de apresentação",
    description: "Slides em tópicos, com o que falar em cada um.",
    icon: "presentation",
    action: "Montar estrutura",
    titleFrom: "tema",
    fields: [
      { type: "textarea", name: "tema", label: "Tema e objetivo da apresentação", required: true, maxLength: 1500 },
      { type: "text", name: "publico", label: "Quem vai assistir?", maxLength: 200 },
      {
        type: "select",
        name: "slides",
        label: "Quantidade de slides",
        options: ["5", "8", "12"].map((n) => ({ value: n, label: `${n} slides` })),
      },
    ],
    instruction:
      "Monte a estrutura de uma apresentação: para cada slide, um título (### Slide N — título), de 2 a 4 tópicos curtos e uma linha “Fala:” com o que dizer. É um roteiro em texto, não um arquivo de slides.",
    buildPrompt: (x) =>
      `Monte a estrutura de uma apresentação.\n${line("Tema e objetivo", v(x, "tema"))}${line("Público", v(x, "publico"))}${line("Slides", v(x, "slides"))}`,
  },
  {
    id: "reescrever",
    group: "conteudo",
    title: "Reescrever texto",
    description: "Mude o tom ou o tamanho de um texto seu.",
    icon: "pen",
    action: "Reescrever texto",
    titleFrom: "texto",
    fields: [
      { type: "textarea", name: "texto", label: "Texto original", required: true, maxLength: 3500 },
      TONE,
      {
        type: "select",
        name: "tamanho",
        label: "Tamanho",
        options: [
          { value: "mais curto", label: "Mais curto" },
          { value: "do mesmo tamanho", label: "Mesmo tamanho" },
          { value: "mais longo", label: "Mais longo" },
        ],
      },
    ],
    instruction:
      "Reescreva o texto mantendo o sentido e todos os fatos. Não acrescente informações novas. Entregue só o texto reescrito.",
    buildPrompt: (x) =>
      `Reescreva o texto abaixo.\n${line("Tom desejado", v(x, "tom"))}${line("Tamanho", v(x, "tamanho"))}\n<texto>\n${v(x, "texto")}\n</texto>`,
  },

  // --- Estudo -----------------------------------------------------------------
  {
    id: "explicar",
    group: "estudo",
    title: "Explicação passo a passo",
    description: "Entenda um assunto do zero, no seu nível.",
    icon: "lightbulb",
    action: "Explicar assunto",
    titleFrom: "assunto",
    fields: [
      { type: "textarea", name: "assunto", label: "O que você quer entender?", required: true, maxLength: 1500 },
      LEVEL,
    ],
    instruction:
      "Explique passo a passo, adaptando a linguagem ao nível informado. Use um exemplo do cotidiano. Termine com 3 perguntas de revisão (sem as respostas) sob o título “Para conferir se entendeu”.",
    buildPrompt: (x) => `Explique este assunto.\n${line("Assunto", v(x, "assunto"))}${line("Nível", v(x, "nivel"))}`,
  },
  {
    id: "resumo",
    group: "estudo",
    title: "Resumo",
    description: "Cole um texto e receba os pontos principais.",
    icon: "list",
    action: "Resumir texto",
    titleFrom: "texto",
    fields: [
      { type: "textarea", name: "texto", label: "Texto para resumir", required: true, maxLength: 3800, hint: "Para textos maiores, envie o arquivo no Assistente." },
      SIZE,
    ],
    instruction:
      "Resuma o texto fornecido usando apenas o que está nele. Comece com uma frase-síntese e depois liste os pontos principais. Não acrescente informações externas.",
    buildPrompt: (x) => `Resuma o texto abaixo.\n${line("Tamanho do resumo", v(x, "tamanho"))}\n<texto>\n${v(x, "texto")}\n</texto>`,
  },
  {
    id: "plano-de-estudos",
    group: "estudo",
    title: "Plano de estudos",
    description: "Cronograma semanal para o que você quer aprender.",
    icon: "calendar",
    action: "Montar plano",
    titleFrom: "objetivo",
    fields: [
      { type: "textarea", name: "objetivo", label: "O que você quer aprender?", required: true, maxLength: 1000 },
      LEVEL,
      {
        type: "select",
        name: "tempo",
        label: "Tempo disponível por semana",
        options: [
          { value: "2 horas", label: "2 horas" },
          { value: "5 horas", label: "5 horas" },
          { value: "10 horas", label: "10 horas" },
          { value: "20 horas", label: "20 horas" },
        ],
      },
      {
        type: "select",
        name: "prazo",
        label: "Prazo",
        options: [
          { value: "2 semanas", label: "2 semanas" },
          { value: "1 mês", label: "1 mês" },
          { value: "3 meses", label: "3 meses" },
          { value: "6 meses", label: "6 meses" },
        ],
      },
    ],
    instruction:
      "Monte um plano de estudos realista, semana a semana, respeitando o tempo disponível. Para cada semana: tópicos, atividade prática e como revisar. Não prometa resultados (aprovação, fluência, notas): fale em metas de estudo.",
    buildPrompt: (x) =>
      `Monte um plano de estudos.\n${line("Objetivo", v(x, "objetivo"))}${line("Nível", v(x, "nivel"))}${line("Tempo por semana", v(x, "tempo"))}${line("Prazo", v(x, "prazo"))}`,
  },

  // --- Dia a dia --------------------------------------------------------------
  {
    id: "viagem",
    group: "dia_a_dia",
    title: "Planejador de viagens",
    description: "Roteiro dia a dia para o destino e o estilo que você quer.",
    icon: "plane",
    action: "Montar roteiro",
    titleFrom: "destino",
    fields: [
      { type: "text", name: "destino", label: "Destino", required: true, maxLength: 200 },
      { type: "text", name: "duracao", label: "Quantos dias e em que época?", placeholder: "Ex.: 5 dias em julho", maxLength: 120 },
      { type: "text", name: "viajantes", label: "Quem vai?", placeholder: "Ex.: casal com duas crianças", maxLength: 200 },
      { type: "textarea", name: "interesses", label: "O que vocês gostam de fazer?", maxLength: 800 },
      { type: "text", name: "orcamento", label: "Orçamento aproximado", maxLength: 120 },
    ],
    instruction:
      "Monte um roteiro dia a dia (manhã, tarde, noite) com ritmo viável. IMPORTANTE: você não tem dados em tempo real. Não cite preços, horários de funcionamento ou disponibilidade como fatos; termine com a seção “Confira antes de ir” listando o que precisa ser verificado (documentos, ingressos, horários, clima).",
    buildPrompt: (x) =>
      `Planeje uma viagem.\n${line("Destino", v(x, "destino"))}${line("Duração e época", v(x, "duracao"))}${line("Viajantes", v(x, "viajantes"))}${line("Interesses", v(x, "interesses"))}${line("Orçamento", v(x, "orcamento"))}`,
  },
  {
    id: "refeicoes",
    group: "dia_a_dia",
    title: "Planejamento de refeições",
    description: "Cardápio da semana e lista de compras.",
    icon: "utensils",
    action: "Montar cardápio",
    titleFrom: "preferencias",
    listable: true,
    fields: [
      { type: "text", name: "pessoas", label: "Para quantas pessoas?", placeholder: "Ex.: 4 pessoas", required: true, maxLength: 80 },
      {
        type: "select",
        name: "dias",
        label: "Quantos dias",
        options: ["3", "5", "7"].map((n) => ({ value: `${n} dias`, label: `${n} dias` })),
      },
      { type: "textarea", name: "preferencias", label: "Preferências e restrições", placeholder: "Ex.: sem carne de porco, refeições rápidas à noite", maxLength: 800 },
    ],
    instruction:
      "Monte um cardápio em tabela (dia, almoço, jantar) e, em seguida, a seção “Lista de compras” em lista com marcadores, agrupada por setor do mercado. Respeite as restrições informadas. Não faça recomendações médicas ou de dieta terapêutica.",
    buildPrompt: (x) =>
      `Planeje refeições.\n${line("Pessoas", v(x, "pessoas"))}${line("Dias", v(x, "dias"))}${line("Preferências e restrições", v(x, "preferencias"))}`,
  },
  {
    id: "compras",
    group: "dia_a_dia",
    title: "Organizar compras",
    description: "Cole os itens soltos e receba a lista por setor.",
    icon: "cart",
    action: "Organizar lista",
    titleFrom: "itens",
    listable: true,
    fields: [
      { type: "textarea", name: "itens", label: "O que você precisa comprar?", placeholder: "Ex.: arroz, sabão em pó, 2 kg de patinho, tomate, pão…", required: true, maxLength: 2500 },
    ],
    instruction:
      "Organize os itens informados em lista com marcadores, agrupados por setor do mercado (títulos em negrito). Não acrescente itens que o usuário não pediu e não remova nenhum. Junte itens repetidos.",
    buildPrompt: (x) => `Organize esta lista de compras por setor:\n<itens>\n${v(x, "itens")}\n</itens>`,
  },
  {
    id: "comparar",
    group: "dia_a_dia",
    title: "Comparar opções",
    description: "Tabela comparativa com o que você informar sobre cada opção.",
    icon: "scale",
    action: "Comparar opções",
    titleFrom: "opcoes",
    fields: [
      { type: "textarea", name: "opcoes", label: "Opções e o que você sabe de cada uma", placeholder: "Ex.: Plano A custa 99 e tem 20 GB; Plano B custa 129 e tem 50 GB…", required: true, maxLength: 3000 },
      { type: "text", name: "criterios", label: "O que mais importa para você?", maxLength: 300 },
    ],
    instruction:
      "Compare as opções em uma tabela usando EXCLUSIVAMENTE as informações fornecidas. Onde faltar dado, escreva “não informado” — nunca complete com suposições ou conhecimento externo. Depois da tabela, indique qual opção atende melhor aos critérios e quais informações faltam para decidir com segurança.",
    buildPrompt: (x) =>
      `Compare as opções abaixo.\n${line("Critérios importantes", v(x, "criterios"))}\n<opcoes>\n${v(x, "opcoes")}\n</opcoes>`,
  },
  {
    id: "evento",
    group: "dia_a_dia",
    title: "Organizar evento",
    description: "Lista de preparativos com prazos para a sua festa ou reunião.",
    icon: "confetti",
    action: "Montar preparativos",
    titleFrom: "evento",
    listable: true,
    fields: [
      { type: "text", name: "evento", label: "Que evento é?", placeholder: "Ex.: aniversário de 10 anos", required: true, maxLength: 200 },
      { type: "text", name: "convidados", label: "Quantos convidados?", maxLength: 80 },
      { type: "text", name: "quando", label: "Quando será?", maxLength: 120 },
      { type: "text", name: "orcamento", label: "Orçamento aproximado", maxLength: 120 },
    ],
    instruction:
      "Monte os preparativos em lista com marcadores, agrupados por prazo (títulos em negrito: “Com antecedência”, “Na semana”, “No dia”). Inclua uma sugestão de divisão do orçamento em percentuais, deixando claro que é uma sugestão.",
    buildPrompt: (x) =>
      `Organize um evento.\n${line("Evento", v(x, "evento"))}${line("Convidados", v(x, "convidados"))}${line("Quando", v(x, "quando"))}${line("Orçamento", v(x, "orcamento"))}`,
  },
  {
    id: "tecnologia",
    group: "dia_a_dia",
    title: "Explicar tecnologia",
    description: "Dúvidas de celular, computador e internet, sem termos difíceis.",
    icon: "smartphone",
    action: "Explicar",
    titleFrom: "duvida",
    fields: [
      { type: "textarea", name: "duvida", label: "Qual é a sua dúvida?", placeholder: "Ex.: o que é backup em nuvem e como ativar no meu celular?", required: true, maxLength: 1500 },
      { type: "text", name: "aparelho", label: "Qual aparelho ou programa?", maxLength: 200 },
    ],
    instruction:
      "Explique sem jargão; quando usar um termo técnico, diga o que significa. Se houver passos, numere-os. Menus e nomes de botões mudam entre versões: avise quando o caminho puder ser diferente no aparelho da pessoa.",
    buildPrompt: (x) => `Explique esta dúvida de tecnologia.\n${line("Dúvida", v(x, "duvida"))}${line("Aparelho ou programa", v(x, "aparelho"))}`,
  },
];

export function getTool(id: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.id === id);
}

export type ValidatedTool = { ok: true; values: ToolValues } | { ok: false; fieldErrors: Record<string, string> };

/** Valida os valores recebidos contra os campos declarados (servidor e navegador usam a mesma regra). */
export function validateToolValues(tool: ToolDefinition, raw: Record<string, unknown>): ValidatedTool {
  const values: ToolValues = {};
  const fieldErrors: Record<string, string> = {};
  for (const field of tool.fields) {
    const input = raw[field.name];
    if (field.type === "checkbox") {
      values[field.name] = input === true || input === "on" || input === "true";
      continue;
    }
    const text = typeof input === "string" ? input.trim() : "";
    if (field.type === "select") {
      const allowed = field.options.some((o) => o.value === text);
      values[field.name] = allowed ? text : field.options[0].value;
      continue;
    }
    if (field.required && !text) {
      fieldErrors[field.name] = "Preencha este campo.";
      continue;
    }
    if (text.length > field.maxLength) {
      fieldErrors[field.name] = `Use até ${field.maxLength.toLocaleString("pt-BR")} caracteres.`;
      continue;
    }
    values[field.name] = text;
  }
  return Object.keys(fieldErrors).length > 0 ? { ok: false, fieldErrors } : { ok: true, values };
}

// ---------------------------------------------------------------------------
// Gerações estruturadas (resposta em JSON, validada no servidor)
// ---------------------------------------------------------------------------
export type StructuredKind = "cartoes" | "quiz" | "etapas";

export const STRUCTURED_LIMITS = {
  cartoes: { min: 3, max: 20 },
  quiz: { min: 3, max: 10 },
  etapas: { min: 3, max: 12 },
} as const;
