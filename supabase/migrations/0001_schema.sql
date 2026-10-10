-- VIVA AI — esquema principal
-- Regra geral: cada linha pertence a um usuário (user_id) e só ele a enxerga (RLS).
-- Tabelas de cobrança, consumo, limites e auditoria só são gravadas pelo servidor
-- (chave service_role), nunca pelo navegador.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Perfis e preferências
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  -- Faixa etária declarada no cadastro. A data de nascimento não é guardada.
  age_band text check (age_band in ('adulto', 'adolescente')),
  locale text not null default 'pt-BR' check (locale in ('pt-BR')),
  timezone text not null default 'America/Sao_Paulo' check (char_length(timezone) <= 64),
  role text not null default 'user' check (role in ('user', 'admin')),
  terms_accepted_at timestamptz,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'sistema' check (theme in ('sistema', 'claro', 'escuro')),
  response_style text not null default 'equilibrado'
    check (response_style in ('direto', 'equilibrado', 'detalhado')),
  goals text[] not null default '{}' check (cardinality(goals) <= 8),
  enter_to_send boolean not null default true,
  -- Memória personalizada: desligada até o usuário aceitar.
  memory_enabled boolean not null default false,
  memory_consent_at timestamptz,
  gamification_enabled boolean not null default true,
  weekly_task_goal integer check (weekly_task_goal between 1 and 100),
  voice_reply boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger user_preferences_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Assinaturas e família (gravadas somente pelo servidor)
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'gratuito' check (plan in ('gratuito', 'plus', 'familia')),
  status text not null default 'active'
    check (status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.families (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null default 'Minha família' check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  -- Uma pessoa participa de no máximo uma família.
  user_id uuid not null unique references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create table public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  email text not null check (char_length(email) <= 254),
  -- Guardamos só o hash do código do convite.
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index family_invites_family_idx on public.family_invites (family_id);

create table public.billing_events (
  id bigint generated always as identity primary key,
  stripe_event_id text not null unique,
  type text not null,
  user_id uuid references auth.users (id) on delete set null,
  status text not null default 'processado' check (status in ('processado', 'ignorado', 'erro')),
  detail text,
  created_at timestamptz not null default now()
);
create index billing_events_created_idx on public.billing_events (created_at desc);

-- ---------------------------------------------------------------------------
-- Projetos, tarefas, listas e objetivos
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  goal text not null default '' check (char_length(goal) <= 2000),
  status text not null default 'ativo' check (status in ('ativo', 'concluido', 'arquivado')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_user_idx on public.projects (user_id, updated_at desc);
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create table public.project_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index project_notes_project_idx on public.project_notes (project_id, created_at desc);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  notes text not null default '' check (char_length(notes) <= 4000),
  priority smallint not null default 2 check (priority between 1 and 3), -- 1 alta, 2 média, 3 baixa
  due_date date,
  recurrence text not null default 'nenhuma'
    check (recurrence in ('nenhuma', 'diaria', 'semanal', 'mensal')),
  completed_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_user_open_idx on public.tasks (user_id, due_date) where completed_at is null;
create index tasks_user_done_idx on public.tasks (user_id, completed_at desc) where completed_at is not null;
create index tasks_project_idx on public.tasks (project_id) where project_id is not null;
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  kind text not null default 'lista' check (kind in ('lista', 'compras')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lists_user_idx on public.lists (user_id, updated_at desc);
create trigger lists_updated_at before update on public.lists
  for each row execute function public.set_updated_at();

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 300),
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index list_items_list_idx on public.list_items (list_id, position, created_at);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  unit text not null default '' check (char_length(unit) <= 30),
  target_value numeric(12, 2) not null check (target_value > 0),
  current_value numeric(12, 2) not null default 0 check (current_value >= 0),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index goals_user_idx on public.goals (user_id, created_at desc);
create trigger goals_updated_at before update on public.goals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Conversas, mensagens e arquivos
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  title text not null default 'Nova conversa' check (char_length(title) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index conversations_user_idx on public.conversations (user_id, last_message_at desc);
create index conversations_project_idx on public.conversations (project_id) where project_id is not null;
create index conversations_title_trgm on public.conversations using gin (title extensions.gin_trgm_ops);
create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '' check (char_length(content) <= 120000),
  status text not null default 'completa' check (status in ('completa', 'interrompida', 'erro')),
  model text,
  input_tokens integer,
  output_tokens integer,
  feedback smallint check (feedback in (-1, 1)),
  created_at timestamptz not null default now(),
  fts tsvector generated always as (to_tsvector('portuguese', left(content, 20000))) stored
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_user_idx on public.messages (user_id, created_at desc);
create index messages_fts_idx on public.messages using gin (fts);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 255),
  mime_type text not null check (char_length(mime_type) <= 120),
  size_bytes integer not null check (size_bytes > 0),
  kind text not null check (kind in ('imagem', 'documento')),
  storage_path text not null unique,
  -- Texto extraído de documentos, usado como contexto da conversa.
  extracted_text text check (char_length(extracted_text) <= 200000),
  text_truncated boolean not null default false,
  created_at timestamptz not null default now()
);
create index files_user_idx on public.files (user_id, created_at desc);

create table public.message_files (
  message_id uuid not null references public.messages (id) on delete cascade,
  file_id uuid not null references public.files (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (message_id, file_id)
);
create index message_files_file_idx on public.message_files (file_id);

-- ---------------------------------------------------------------------------
-- Criações (rascunhos gerados nas ferramentas) e estudo
-- ---------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  tool text not null check (char_length(tool) <= 40),
  title text not null check (char_length(title) between 1 and 160),
  content text not null default '' check (char_length(content) <= 120000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_user_idx on public.documents (user_id, updated_at desc);
create trigger documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

create table public.study_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  level text not null default 'intermediario'
    check (level in ('iniciante', 'intermediario', 'avancado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index study_decks_user_idx on public.study_decks (user_id, updated_at desc);
create trigger study_decks_updated_at before update on public.study_decks
  for each row execute function public.set_updated_at();

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.study_decks (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  front text not null check (char_length(front) between 1 and 1000),
  back text not null check (char_length(back) between 1 and 2000),
  -- Repetição espaçada simples (caixas de Leitner 1 a 5).
  box smallint not null default 1 check (box between 1 and 5),
  due_at timestamptz not null default now(),
  review_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index flashcards_deck_idx on public.flashcards (deck_id, due_at);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  -- [{ "pergunta": "...", "opcoes": ["..."], "correta": 0, "explicacao": "..." }]
  questions jsonb not null check (jsonb_typeof(questions) = 'array'),
  created_at timestamptz not null default now()
);
create index quizzes_user_idx on public.quizzes (user_id, created_at desc);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  score integer not null check (score >= 0),
  total integer not null check (total > 0),
  answers jsonb not null default '[]',
  created_at timestamptz not null default now(),
  check (score <= total)
);
create index quiz_attempts_quiz_idx on public.quiz_attempts (quiz_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Memória personalizada (controlada pelo usuário)
-- ---------------------------------------------------------------------------
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index memories_user_idx on public.memories (user_id, created_at desc);
create trigger memories_updated_at before update on public.memories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Atividade real (base da gamificação), conquistas e feedback
-- ---------------------------------------------------------------------------
create table public.activity_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in (
    'mensagem_enviada', 'tarefa_concluida', 'projeto_criado', 'projeto_concluido',
    'cartao_revisado', 'quiz_concluido', 'criacao_salva', 'objetivo_concluido'
  )),
  -- Dia no fuso do usuário, para sequências de uso.
  day date not null,
  created_at timestamptz not null default now()
);
create index activity_events_user_idx on public.activity_events (user_id, day desc);
create index activity_events_created_idx on public.activity_events (created_at desc);

create table public.user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null check (char_length(code) <= 40),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, code)
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null default 'geral' check (category in ('geral', 'problema', 'sugestao')),
  comment text not null check (char_length(comment) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index feedback_created_idx on public.feedback (created_at desc);

-- ---------------------------------------------------------------------------
-- Consumo, limites e operação (somente servidor)
-- ---------------------------------------------------------------------------
create table public.usage_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('mensagem', 'geracao', 'arquivo')),
  period_start date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, kind, period_start)
);

create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  feature text not null check (char_length(feature) <= 40),
  provider text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  -- Custo estimado em milionésimos de dólar; nulo quando o preço do modelo não foi configurado.
  cost_micro_usd bigint,
  status text not null default 'ok' check (status in ('ok', 'interrompida', 'erro')),
  created_at timestamptz not null default now()
);
create index usage_events_created_idx on public.usage_events (created_at desc);
create index usage_events_user_idx on public.usage_events (user_id, created_at desc);

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

create table public.error_logs (
  id bigint generated always as identity primary key,
  scope text not null check (char_length(scope) <= 60),
  code text check (char_length(code) <= 80),
  -- Mensagem técnica, sem conteúdo de conversas nem dados pessoais.
  message text not null check (char_length(message) <= 500),
  created_at timestamptz not null default now()
);
create index error_logs_created_idx on public.error_logs (created_at desc);

create table public.feature_flags (
  key text primary key check (char_length(key) <= 40),
  enabled boolean not null default true,
  description text not null default '',
  updated_at timestamptz not null default now()
);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) <= 80),
  detail text check (char_length(detail) <= 500),
  created_at timestamptz not null default now()
);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

insert into public.feature_flags (key, enabled, description) values
  ('assistente', true, 'Conversa com a IA'),
  ('anexos', true, 'Envio de arquivos e imagens nas conversas'),
  ('ferramentas_criacao', true, 'Ferramentas de criação de conteúdo'),
  ('estudo', true, 'Cartões de estudo e questionários'),
  ('pesquisa_web', false, 'Pesquisa na web pelo assistente (gera custo adicional)'),
  ('novos_cadastros', true, 'Permitir criação de novas contas');
