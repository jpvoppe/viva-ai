# Banco de dados

Postgres do Supabase. Três migrações em `supabase/migrations/`:

| Arquivo | Conteúdo |
|---|---|
| `0001_schema.sql` | 32 tabelas, índices, busca textual, chaves de recurso (feature flags) |
| `0002_regras_e_seguranca.sql` | Gatilhos, funções, todas as regras de acesso (RLS), permissões |
| `0003_storage.sql` | Pasta privada `anexos` e regras por usuário |

## Tabelas, por assunto

- **Conta:** `profiles`, `user_preferences`, `memories`
- **Assinatura e família:** `subscriptions`, `billing_events`, `families`, `family_members`, `family_invites`
- **Conversas:** `conversations`, `messages`, `files`, `message_files`, `feedback`
- **Organizador:** `tasks`, `lists`, `list_items`, `goals`
- **Projetos:** `projects`, `project_notes`
- **Criação e estudo:** `documents`, `study_decks`, `flashcards`, `quizzes`, `quiz_attempts`
- **Progresso:** `activity_events`, `user_achievements`
- **Consumo e proteção:** `usage_counters`, `usage_events`, `rate_limits`, `error_logs`
- **Administração:** `feature_flags`, `admin_audit_log`

## Regras de acesso

- RLS (regra por linha: o próprio banco recusa ler ou gravar dado de outra pessoa) ligada em **todas** as tabelas.
- Cada usuário só enxerga as próprias linhas. Família: os membros veem só nome e papel uns dos outros,
  nunca conversas, arquivos ou tarefas.
- Plano, papel de administrador, contadores de consumo e eventos de cobrança **não podem ser gravados
  pelo navegador**. Só o servidor grava, com a chave de serviço.
- Funções sensíveis: `consume_quota` (desconta do limite diário de forma atômica), `rate_limit_hit`,
  `effective_plan` (plano que vale, considerando a família), funções `admin_*` (só administrador, só totais).
- Excluir a conta apaga em cascata todos os dados da pessoa e os arquivos dela.

## Alterar o esquema

Crie um novo arquivo numerado (`0004_...sql`). Não edite migração já aplicada em produção.
Toda tabela nova precisa de RLS e de um teste em `tests/integration/seguranca-dados.test.ts`.
