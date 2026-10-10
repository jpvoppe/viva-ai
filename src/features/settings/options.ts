export const GOAL_OPTIONS = [
  { id: "estudar", label: "Estudar e aprender" },
  { id: "organizar", label: "Organizar a rotina" },
  { id: "criar", label: "Criar conteúdo" },
  { id: "trabalho", label: "Render mais no trabalho" },
  { id: "projetos", label: "Tirar projetos do papel" },
  { id: "dia_a_dia", label: "Resolver coisas do dia a dia" },
] as const;

export const GOAL_IDS = GOAL_OPTIONS.map((g) => g.id) as [string, ...string[]];
