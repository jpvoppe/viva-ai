-- VIVA AI — funções, gatilhos, políticas de acesso (RLS) e permissões

alter table public.activity_events add column ref_id uuid;
-- Um evento por item (ex.: concluir e reabrir a mesma tarefa não conta duas vezes).
create unique index activity_events_ref_uniq
  on public.activity_events (user_id, kind, ref_id) where ref_id is not null;

-- ---------------------------------------------------------------------------
-- Novo usuário: cria perfil, preferências e assinatura gratuita
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_age text := new.raw_user_meta_data ->> 'age_band';
  v_name text := left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80);
  v_tz text := left(coalesce(new.raw_user_meta_data ->> 'timezone', 'America/Sao_Paulo'), 64);
begin
  if v_age not in ('adulto', 'adolescente') then
    v_age := null;
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_tz) then
    v_tz := 'America/Sao_Paulo';
  end if;

  insert into public.profiles (id, display_name, age_band, timezone, terms_accepted_at)
  values (
    new.id, v_name, v_age, v_tz,
    case when new.raw_user_meta_data ->> 'terms_accepted' = 'true' then now() end
  );
  insert into public.user_preferences (user_id) values (new.id);
  insert into public.subscriptions (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Papéis e plano efetivo
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

create or replace function public.effective_plan(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.plan from public.subscriptions s
      where s.user_id = p_user and s.plan <> 'gratuito'
        and s.status in ('active', 'trialing', 'past_due')),
    (select 'familia' from public.family_members fm
      join public.families f on f.id = fm.family_id
      join public.subscriptions s on s.user_id = f.owner_id
      where fm.user_id = p_user and s.plan = 'familia'
        and s.status in ('active', 'trialing', 'past_due')),
    'gratuito'
  );
$$;

create or replace function public.my_plan()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.effective_plan((select auth.uid()));
$$;

create or replace function public.my_family_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select f.id from public.families f where f.owner_id = (select auth.uid())),
    (select fm.family_id from public.family_members fm where fm.user_id = (select auth.uid()))
  );
$$;

-- Lista de pessoas da minha família: só nome e papel, nenhum dado privado.
create or replace function public.family_roster()
returns table (user_id uuid, display_name text, is_owner boolean, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with fam as (select public.my_family_id() as id)
  select f.owner_id, p.display_name, true, f.created_at
    from public.families f join fam on fam.id = f.id
    join public.profiles p on p.id = f.owner_id
  union all
  select fm.user_id, p.display_name, false, fm.joined_at
    from public.family_members fm join fam on fam.id = fm.family_id
    join public.profiles p on p.id = fm.user_id;
$$;

-- Tudo que o app precisa saber sobre o usuário atual, em uma única consulta.
create or replace function public.my_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when (select auth.uid()) is null then null else jsonb_build_object(
    'profile', (
      select jsonb_build_object(
        'id', p.id, 'display_name', p.display_name, 'age_band', p.age_band,
        'locale', p.locale, 'timezone', p.timezone, 'role', p.role,
        'terms_accepted_at', p.terms_accepted_at,
        'onboarding_completed_at', p.onboarding_completed_at)
      from public.profiles p where p.id = (select auth.uid())),
    'preferences', (
      select jsonb_build_object(
        'theme', up.theme, 'response_style', up.response_style, 'goals', up.goals,
        'enter_to_send', up.enter_to_send, 'memory_enabled', up.memory_enabled,
        'gamification_enabled', up.gamification_enabled,
        'weekly_task_goal', up.weekly_task_goal, 'voice_reply', up.voice_reply)
      from public.user_preferences up where up.user_id = (select auth.uid())),
    'plan', public.effective_plan((select auth.uid())),
    'subscription', (
      select jsonb_build_object(
        'plan', s.plan, 'status', s.status,
        'current_period_end', s.current_period_end,
        'cancel_at_period_end', s.cancel_at_period_end,
        'has_customer', s.stripe_customer_id is not null)
      from public.subscriptions s where s.user_id = (select auth.uid())),
    'family', (
      select jsonb_build_object('id', f.id, 'name', f.name, 'is_owner', f.owner_id = (select auth.uid()))
      from public.families f where f.id = public.my_family_id()),
    'flags', coalesce((select jsonb_object_agg(ff.key, ff.enabled) from public.feature_flags ff), '{}'::jsonb)
  ) end;
$$;

-- ---------------------------------------------------------------------------
-- Atividade real e conquistas
-- ---------------------------------------------------------------------------
create or replace function public.log_activity(p_user uuid, p_kind text, p_ref uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz text;
begin
  select timezone into v_tz from public.profiles where id = p_user;
  insert into public.activity_events (user_id, kind, ref_id, day)
  values (p_user, p_kind, p_ref, (now() at time zone coalesce(v_tz, 'America/Sao_Paulo'))::date)
  on conflict do nothing;
end;
$$;

create or replace function public.trg_message_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set last_message_at = now() where id = new.conversation_id;
  if new.role = 'user' then
    perform public.log_activity(new.user_id, 'mensagem_enviada', new.id);
  end if;
  return new;
end;
$$;
create trigger messages_activity after insert on public.messages
  for each row execute function public.trg_message_activity();

create or replace function public.trg_task_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.completed_at is not null and (tg_op = 'INSERT' or old.completed_at is null) then
    perform public.log_activity(new.user_id, 'tarefa_concluida', new.id);
  elsif tg_op = 'UPDATE' and new.completed_at is null and old.completed_at is not null then
    delete from public.activity_events
      where user_id = new.user_id and kind = 'tarefa_concluida' and ref_id = new.id;
  end if;
  return new;
end;
$$;
create trigger tasks_activity after insert or update of completed_at on public.tasks
  for each row execute function public.trg_task_activity();

create or replace function public.trg_project_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.user_id, 'projeto_criado', new.id);
  elsif new.status = 'concluido' and old.status <> 'concluido' then
    perform public.log_activity(new.user_id, 'projeto_concluido', new.id);
  end if;
  return new;
end;
$$;
create trigger projects_activity after insert or update of status on public.projects
  for each row execute function public.trg_project_activity();

create or replace function public.trg_flashcard_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.review_count > old.review_count then
    perform public.log_activity(new.user_id, 'cartao_revisado', null);
  end if;
  return new;
end;
$$;
create trigger flashcards_activity after update of review_count on public.flashcards
  for each row execute function public.trg_flashcard_activity();

create or replace function public.trg_quiz_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.log_activity(new.user_id, 'quiz_concluido', new.id);
  return new;
end;
$$;
create trigger quiz_attempts_activity after insert on public.quiz_attempts
  for each row execute function public.trg_quiz_activity();

create or replace function public.trg_document_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.log_activity(new.user_id, 'criacao_salva', new.id);
  return new;
end;
$$;
create trigger documents_activity after insert on public.documents
  for each row execute function public.trg_document_activity();

create or replace function public.trg_goal_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.completed_at is not null and (tg_op = 'INSERT' or old.completed_at is null) then
    perform public.log_activity(new.user_id, 'objetivo_concluido', new.id);
  end if;
  return new;
end;
$$;
create trigger goals_activity after insert or update of completed_at on public.goals
  for each row execute function public.trg_goal_activity();

-- Resumo de progresso do usuário atual, calculado só com eventos registrados.
create or replace function public.my_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_tz text;
  v_today date;
  v_week_start date;
  v_streak integer := 0;
  v_best integer := 0;
  v_result jsonb;
begin
  if v_user is null then
    return null;
  end if;
  select timezone into v_tz from public.profiles where id = v_user;
  v_today := (now() at time zone coalesce(v_tz, 'America/Sao_Paulo'))::date;
  v_week_start := date_trunc('week', v_today::timestamp)::date; -- segunda-feira

  -- Sequências: dias ativos seguidos. Um dia de descanso não quebra a sequência.
  with days as (
    select distinct day from public.activity_events where user_id = v_user
  ), marked as (
    select day, case when day - lag(day) over (order by day) <= 2 then 0 else 1 end as new_group
    from days
  ), grouped as (
    select day, sum(new_group) over (order by day) as grp from marked
  ), runs as (
    select grp, count(*)::integer as len, max(day) as last_day from grouped group by grp
  )
  select
    coalesce(max(len) filter (where last_day >= v_today - 2), 0),
    coalesce(max(len), 0)
  into v_streak, v_best
  from runs;

  select jsonb_build_object(
    'hoje', v_today,
    'sequencia_atual', v_streak,
    'melhor_sequencia', v_best,
    'dias_ativos_semana', (
      select count(distinct day) from public.activity_events
      where user_id = v_user and day >= v_week_start),
    'tarefas_semana', (
      select count(*) from public.activity_events
      where user_id = v_user and kind = 'tarefa_concluida' and day >= v_week_start),
    'totais', coalesce((
      select jsonb_object_agg(kind, total) from (
        select kind, count(*) as total from public.activity_events
        where user_id = v_user group by kind) t), '{}'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

-- Confere as regras de conquistas e devolve as recém-desbloqueadas.
create or replace function public.sync_achievements()
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_stats jsonb;
  v_tot jsonb;
  v_goal integer;
begin
  if v_user is null then
    return;
  end if;
  v_stats := public.my_stats();
  v_tot := v_stats -> 'totais';
  select weekly_task_goal into v_goal from public.user_preferences where user_id = v_user;

  return query
  with rules (code, ok) as (
    values
      ('primeira_conversa', coalesce((v_tot ->> 'mensagem_enviada')::int, 0) >= 1),
      ('primeira_tarefa', coalesce((v_tot ->> 'tarefa_concluida')::int, 0) >= 1),
      ('dez_tarefas', coalesce((v_tot ->> 'tarefa_concluida')::int, 0) >= 10),
      ('cinquenta_tarefas', coalesce((v_tot ->> 'tarefa_concluida')::int, 0) >= 50),
      ('primeiro_projeto', coalesce((v_tot ->> 'projeto_criado')::int, 0) >= 1),
      ('projeto_concluido', coalesce((v_tot ->> 'projeto_concluido')::int, 0) >= 1),
      ('primeira_criacao', coalesce((v_tot ->> 'criacao_salva')::int, 0) >= 1),
      ('estudo_25', coalesce((v_tot ->> 'cartao_revisado')::int, 0) >= 25),
      ('primeiro_quiz', coalesce((v_tot ->> 'quiz_concluido')::int, 0) >= 1),
      ('objetivo_concluido', coalesce((v_tot ->> 'objetivo_concluido')::int, 0) >= 1),
      ('sequencia_3', (v_stats ->> 'melhor_sequencia')::int >= 3),
      ('sequencia_7', (v_stats ->> 'melhor_sequencia')::int >= 7),
      ('meta_semanal', v_goal is not null and (v_stats ->> 'tarefas_semana')::int >= v_goal)
  ), ins as (
    insert into public.user_achievements (user_id, code)
    select v_user, r.code from rules r where r.ok
    on conflict do nothing
    returning code
  )
  select code from ins;
end;
$$;

-- ---------------------------------------------------------------------------
-- Busca no histórico (respeita o RLS de quem chama)
-- ---------------------------------------------------------------------------
create or replace function public.search_conversations(p_query text, p_limit integer default 30)
returns table (id uuid, title text, last_message_at timestamptz, snippet text)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with q as (
    select websearch_to_tsquery('portuguese', left(p_query, 200)) as tsq,
           '%' || replace(replace(replace(left(p_query, 200), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
  ), hits as (
    select distinct on (m.conversation_id)
      m.conversation_id,
      ts_headline('portuguese', left(m.content, 4000), q.tsq,
        'MaxWords=18, MinWords=8, StartSel=«, StopSel=»') as snippet
    from messages m, q
    where m.fts @@ q.tsq
    order by m.conversation_id, m.created_at desc
  )
  select c.id, c.title, c.last_message_at, h.snippet
  from conversations c
  cross join q
  left join hits h on h.conversation_id = c.id
  where h.conversation_id is not null or c.title ilike q.pattern
  order by c.last_message_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

-- ---------------------------------------------------------------------------
-- Cotas e limite de requisições (somente servidor)
-- ---------------------------------------------------------------------------
-- Consome 1 unidade da cota se ainda houver saldo. Atômico: duas chamadas
-- simultâneas não passam do limite.
create or replace function public.consume_quota(
  p_user uuid, p_kind text, p_period date, p_limit integer
)
returns table (allowed boolean, used integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used integer;
begin
  if p_limit <= 0 then
    return query select false, 0;
    return;
  end if;
  insert into public.usage_counters as uc (user_id, kind, period_start, count)
  values (p_user, p_kind, p_period, 1)
  on conflict (user_id, kind, period_start)
  do update set count = uc.count + 1 where uc.count < p_limit
  returning uc.count into v_used;

  if v_used is null then
    select uc.count into v_used from public.usage_counters uc
      where uc.user_id = p_user and uc.kind = p_kind and uc.period_start = p_period;
    return query select false, coalesce(v_used, 0);
  else
    return query select true, v_used;
  end if;
end;
$$;

-- Devolve 1 unidade quando a operação falhou antes de gerar custo.
create or replace function public.refund_quota(p_user uuid, p_kind text, p_period date)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.usage_counters set count = greatest(count - 1, 0)
  where user_id = p_user and kind = p_kind and period_start = p_period;
$$;

-- Janela fixa: devolve true se a requisição cabe no limite.
create or replace function public.rate_limit_hit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = rl.count + 1
  returning rl.count into v_count;

  -- Limpeza oportunista de janelas antigas.
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_count <= p_max;
end;
$$;

-- Custo estimado de IA desde um instante (trava de orçamento). Somente servidor.
create or replace function public.ai_spend_since(p_since timestamptz)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(cost_micro_usd), 0)::bigint from public.usage_events where created_at >= p_since;
$$;

-- ---------------------------------------------------------------------------
-- Painel administrativo: somente números agregados
-- ---------------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'usuarios_total', (select count(*) from public.profiles),
    'usuarios_novos_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'ativos_1d', (select count(distinct user_id) from public.activity_events where created_at > now() - interval '1 day'),
    'ativos_7d', (select count(distinct user_id) from public.activity_events where created_at > now() - interval '7 days'),
    'ativos_30d', (select count(distinct user_id) from public.activity_events where created_at > now() - interval '30 days'),
    'assinaturas', coalesce((
      select jsonb_agg(jsonb_build_object('plano', plan, 'status', status, 'total', total) order by plan, status)
      from (select plan, status, count(*) as total from public.subscriptions group by plan, status) s), '[]'::jsonb),
    'ia_30d', (
      select jsonb_build_object(
        'chamadas', count(*),
        'tokens_entrada', coalesce(sum(input_tokens), 0),
        'tokens_saida', coalesce(sum(output_tokens), 0),
        'custo_micro_usd', coalesce(sum(cost_micro_usd), 0),
        'chamadas_sem_preco', count(*) filter (where cost_micro_usd is null),
        'erros', count(*) filter (where status = 'erro'))
      from public.usage_events where created_at > now() - interval '30 days'),
    'ia_hoje', (
      select jsonb_build_object(
        'chamadas', count(*),
        'custo_micro_usd', coalesce(sum(cost_micro_usd), 0))
      from public.usage_events where created_at > now() - interval '1 day'),
    'erros_24h', (select count(*) from public.error_logs where created_at > now() - interval '1 day'),
    'avaliacoes_30d', (
      select jsonb_build_object(
        'positivas', count(*) filter (where feedback = 1),
        'negativas', count(*) filter (where feedback = -1))
      from public.messages where feedback is not null and created_at > now() - interval '30 days'),
    'cobranca_eventos_erro_7d', (
      select count(*) from public.billing_events where status = 'erro' and created_at > now() - interval '7 days')
  );
end;
$$;

create or replace function public.admin_usage_daily(p_days integer default 14)
returns table (dia date, chamadas bigint, tokens_entrada bigint, tokens_saida bigint, custo_micro_usd bigint, usuarios bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return query
  select d::date,
         count(u.id),
         coalesce(sum(u.input_tokens), 0)::bigint,
         coalesce(sum(u.output_tokens), 0)::bigint,
         coalesce(sum(u.cost_micro_usd), 0)::bigint,
         count(distinct u.user_id)
  from generate_series(
         (now() at time zone 'America/Sao_Paulo')::date - (least(greatest(p_days, 1), 90) - 1),
         (now() at time zone 'America/Sao_Paulo')::date, interval '1 day') d
  left join public.usage_events u
    on (u.created_at at time zone 'America/Sao_Paulo')::date = d::date
  group by d
  order by d;
end;
$$;

create or replace function public.admin_feature_usage(p_days integer default 30)
returns table (recurso text, eventos bigint, usuarios bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return query
  select a.kind, count(*), count(distinct a.user_id)
  from public.activity_events a
  where a.created_at > now() - make_interval(days => least(greatest(p_days, 1), 365))
  group by a.kind
  order by count(*) desc;
end;
$$;

create or replace function public.admin_recent_errors(p_limit integer default 50)
returns table (id bigint, scope text, code text, message text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return query
  select e.id, e.scope, e.code, e.message, e.created_at
  from public.error_logs e order by e.created_at desc
  limit least(greatest(p_limit, 1), 200);
end;
$$;

-- Comentários enviados voluntariamente pelos usuários (sem identificar quem enviou).
create or replace function public.admin_feedback(p_limit integer default 50)
returns table (id uuid, category text, comment text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return query
  select f.id, f.category, f.comment, f.created_at
  from public.feedback f order by f.created_at desc
  limit least(greatest(p_limit, 1), 200);
end;
$$;

create or replace function public.admin_billing_events(p_limit integer default 30)
returns table (id bigint, type text, status text, detail text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return query
  select b.id, b.type, b.status, b.detail, b.created_at
  from public.billing_events b order by b.created_at desc
  limit least(greatest(p_limit, 1), 200);
end;
$$;

create or replace function public.admin_set_flag(p_key text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  update public.feature_flags set enabled = p_enabled, updated_at = now() where key = p_key;
  if not found then
    raise exception 'recurso inexistente';
  end if;
  insert into public.admin_audit_log (admin_id, action, detail)
  values ((select auth.uid()), 'alterar_recurso', p_key || ' = ' || p_enabled::text);
end;
$$;

create or replace function public.admin_audit(p_limit integer default 30)
returns table (id bigint, action text, detail text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return query
  select a.id, a.action, a.detail, a.created_at
  from public.admin_audit_log a order by a.created_at desc
  limit least(greatest(p_limit, 1), 200);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: liga em todas as tabelas
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$$;

-- Tabelas "minhas linhas": leitura e escrita somente do dono.
do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'lists', 'goals', 'conversations', 'documents', 'study_decks',
    'quizzes', 'memories'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t || '_dono', t);
  end loop;
end;
$$;

-- Conversa só pode apontar para projeto do próprio usuário.
create policy conversations_projeto_proprio on public.conversations as restrictive
  for all to authenticated
  using (true)
  with check (project_id is null or exists (
    select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())));

create policy documents_projeto_proprio on public.documents as restrictive
  for all to authenticated
  using (true)
  with check (project_id is null or exists (
    select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())));

-- Tarefas: do dono e, se ligadas a projeto, o projeto também é dele.
grant select, insert, update, delete on public.tasks to authenticated;
create policy tasks_dono on public.tasks for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (project_id is null or exists (
      select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid()))));

grant select, insert, update, delete on public.project_notes to authenticated;
create policy project_notes_dono on public.project_notes for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())));

grant select, insert, update, delete on public.list_items to authenticated;
create policy list_items_dono on public.list_items for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.lists l where l.id = list_id and l.user_id = (select auth.uid())));

grant select, insert, update, delete on public.flashcards to authenticated;
create policy flashcards_dono on public.flashcards for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.study_decks d where d.id = deck_id and d.user_id = (select auth.uid())));

grant select, insert, delete on public.quiz_attempts to authenticated;
create policy quiz_attempts_dono on public.quiz_attempts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.quizzes q where q.id = quiz_id and q.user_id = (select auth.uid())));

-- Mensagens: o conteúdo não pode ser alterado depois; só a avaliação (feedback).
grant select, insert, delete on public.messages to authenticated;
grant update (feedback) on public.messages to authenticated;
create policy messages_dono on public.messages for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.conversations c
                where c.id = conversation_id and c.user_id = (select auth.uid())));

grant select, insert, delete on public.files to authenticated;
create policy files_dono on public.files for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    -- O caminho do arquivo sempre começa com a pasta do próprio usuário.
    and storage_path like (select auth.uid())::text || '/%');

grant select, insert, delete on public.message_files to authenticated;
create policy message_files_dono on public.message_files for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.messages m where m.id = message_id and m.user_id = (select auth.uid()))
    and exists (select 1 from public.files f where f.id = file_id and f.user_id = (select auth.uid())));

grant select, insert on public.feedback to authenticated;
create policy feedback_dono_le on public.feedback for select to authenticated
  using (user_id = (select auth.uid()));
create policy feedback_dono_cria on public.feedback for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Perfil: o usuário lê o próprio e altera só nome, fuso e a conclusão das boas-vindas.
-- Papel (admin) e faixa etária não são alteráveis pelo navegador.
grant select on public.profiles to authenticated;
grant update (display_name, timezone, onboarding_completed_at) on public.profiles to authenticated;
create policy profiles_dono_le on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_dono_altera on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

grant select on public.user_preferences to authenticated;
grant update (theme, response_style, goals, enter_to_send, memory_enabled, memory_consent_at,
              gamification_enabled, weekly_task_goal, voice_reply)
  on public.user_preferences to authenticated;
create policy user_preferences_dono_le on public.user_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_preferences_dono_altera on public.user_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Somente leitura para o dono; gravação apenas pelo servidor.
grant select on public.subscriptions to authenticated;
create policy subscriptions_dono_le on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.usage_counters to authenticated;
create policy usage_counters_dono_le on public.usage_counters for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.activity_events to authenticated;
create policy activity_events_dono_le on public.activity_events for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.user_achievements to authenticated;
create policy user_achievements_dono_le on public.user_achievements for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.families to authenticated;
create policy families_membro_le on public.families for select to authenticated
  using (id = (select public.my_family_id()));

grant select on public.family_members to authenticated;
create policy family_members_membro_le on public.family_members for select to authenticated
  using (family_id = (select public.my_family_id()));

-- Convites: só o responsável pela família enxerga.
grant select on public.family_invites to authenticated;
create policy family_invites_dono_le on public.family_invites for select to authenticated
  using (exists (select 1 from public.families f
                 where f.id = family_id and f.owner_id = (select auth.uid())));

-- Recursos habilitados: leitura pública (não contém dado pessoal).
grant select on public.feature_flags to anon, authenticated;
create policy feature_flags_leitura on public.feature_flags for select to anon, authenticated
  using (true);

-- usage_events, rate_limits, error_logs, billing_events e admin_audit_log:
-- sem política e sem permissão para anon/authenticated = acesso só pelo servidor.

-- ---------------------------------------------------------------------------
-- Permissões de execução das funções
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.is_admin(), public.my_plan(), public.my_family_id(), public.family_roster(),
  public.my_context(),
  public.my_stats(), public.sync_achievements(),
  public.search_conversations(text, integer),
  public.admin_overview(), public.admin_usage_daily(integer), public.admin_feature_usage(integer),
  public.admin_recent_errors(integer), public.admin_feedback(integer),
  public.admin_billing_events(integer), public.admin_set_flag(text, boolean), public.admin_audit(integer)
to authenticated;

grant execute on all functions in schema public to service_role;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Funções criadas depois desta migração não ficam abertas por padrão.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
