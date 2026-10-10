export type Achievement = { code: string; title: string; description: string };

/** Catálogo de conquistas. As regras de desbloqueio ficam no banco (sync_achievements). */
export const ACHIEVEMENTS: Achievement[] = [
  { code: "primeira_conversa", title: "Primeira conversa", description: "Enviou a primeira mensagem ao VIVA." },
  { code: "primeira_tarefa", title: "Primeira tarefa", description: "Concluiu a primeira tarefa." },
  { code: "dez_tarefas", title: "Dez concluídas", description: "Concluiu 10 tarefas." },
  { code: "cinquenta_tarefas", title: "Cinquenta concluídas", description: "Concluiu 50 tarefas." },
  { code: "primeiro_projeto", title: "Ideia no papel", description: "Criou o primeiro projeto." },
  { code: "projeto_concluido", title: "Projeto entregue", description: "Concluiu um projeto." },
  { code: "primeira_criacao", title: "Primeira criação", description: "Salvou o primeiro conteúdo criado." },
  { code: "estudo_25", title: "Mente afiada", description: "Revisou 25 cartões de estudo." },
  { code: "primeiro_quiz", title: "Primeiro questionário", description: "Respondeu um questionário até o fim." },
  { code: "objetivo_concluido", title: "Objetivo alcançado", description: "Chegou à meta de um objetivo." },
  { code: "sequencia_3", title: "Três dias em movimento", description: "Usou o VIVA em 3 dias seguidos." },
  { code: "sequencia_7", title: "Uma semana em movimento", description: "Usou o VIVA em 7 dias seguidos." },
  { code: "meta_semanal", title: "Meta da semana", description: "Bateu a meta semanal de tarefas." },
];

export function achievementByCode(code: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.code === code);
}
