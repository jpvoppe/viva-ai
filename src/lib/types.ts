import type { PlanId } from "@/lib/plans";

export type AgeBand = "adulto" | "adolescente";
export type ThemePreference = "sistema" | "claro" | "escuro";
export type ResponseStyle = "direto" | "equilibrado" | "detalhado";

export type Profile = {
  id: string;
  display_name: string;
  age_band: AgeBand | null;
  locale: string;
  timezone: string;
  role: "user" | "admin";
  terms_accepted_at: string | null;
  onboarding_completed_at: string | null;
};

export type Preferences = {
  theme: ThemePreference;
  response_style: ResponseStyle;
  goals: string[];
  enter_to_send: boolean;
  memory_enabled: boolean;
  gamification_enabled: boolean;
  weekly_task_goal: number | null;
  voice_reply: boolean;
};

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

export type SubscriptionInfo = {
  plan: PlanId;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  has_customer: boolean;
};

export type FeatureFlags = Record<string, boolean>;

export type UserContext = {
  email: string;
  profile: Profile;
  preferences: Preferences;
  plan: PlanId;
  subscription: SubscriptionInfo;
  family: { id: string; name: string; is_owner: boolean } | null;
  flags: FeatureFlags;
};

/** Resultado padrão das ações do servidor: ou deu certo, ou vem a mensagem do erro. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type Priority = 1 | 2 | 3;
export type Recurrence = "nenhuma" | "diaria" | "semanal" | "mensal";

export type Task = {
  id: string;
  project_id: string | null;
  title: string;
  notes: string;
  priority: Priority;
  due_date: string | null;
  recurrence: Recurrence;
  completed_at: string | null;
  created_at: string;
};

export type Project = {
  id: string;
  name: string;
  goal: string;
  status: "ativo" | "concluido" | "arquivado";
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationSummary = {
  id: string;
  title: string;
  last_message_at: string;
  project_id?: string | null;
};

export type MessageStatus = "completa" | "interrompida" | "erro";

export type AttachmentInfo = {
  id: string;
  name: string;
  kind: "imagem" | "documento";
  size_bytes: number;
  mime_type: string;
};

export type ChatMessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: MessageStatus;
  feedback: -1 | 1 | null;
  created_at: string;
  attachments: AttachmentInfo[];
};

export type Stats = {
  hoje: string;
  sequencia_atual: number;
  melhor_sequencia: number;
  dias_ativos_semana: number;
  tarefas_semana: number;
  totais: Record<string, number>;
};
