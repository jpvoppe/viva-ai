# Instalação

Requisitos: Node.js 20.9 ou mais novo, uma conta no Supabase, uma chave de IA (Anthropic) e,
se for cobrar, uma conta Stripe.

## 1. Supabase

1. Crie um projeto em supabase.com (região São Paulo, se o público for brasileiro).
2. Em **SQL Editor**, rode os três arquivos de `supabase/migrations/` **na ordem**:
   `0001_schema.sql`, `0002_regras_e_seguranca.sql`, `0003_storage.sql`.
   (Com a CLI do Supabase: `supabase link` e `supabase db push`.)
3. Em **Project Settings → API**, copie a URL, a chave `anon` e a chave `service_role`.
4. Em **Authentication → URL Configuration**:
   - Site URL: o endereço público do app (ex.: `https://seu-dominio.com.br`).
   - Redirect URLs: `https://seu-dominio.com.br/auth/callback` e `http://localhost:3000/auth/callback`.
5. Em **Authentication → Email Templates** (recomendado): troque o link dos modelos para o formato
   que funciona mesmo quando a pessoa abre o e-mail em outro aparelho:
   - Confirmação de cadastro: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/app`
   - Recuperação de senha: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/redefinir-senha`
6. Em **Authentication → SMTP**: configure um serviço de envio próprio antes de abrir ao público.
   O envio embutido do Supabase tem limite baixo de e-mails por hora.

## 2. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha. O arquivo explica cada variável.
`.env.local` nunca vai para o repositório.

## 3. Rodar

```bash
npm install
npm run dev
```

Crie sua conta em `/criar-conta`.

## 4. Primeiro administrador

O papel de administrador não pode ser alterado pelo app (de propósito). No **SQL Editor** do Supabase:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'seu-email@exemplo.com');
```

O painel fica em `/admin`. Quem não é administrador é mandado de volta para o app.

## 5. IA simulada (só para desenvolvimento)

Para mexer nas telas sem gastar com IA: `AI_PROVIDER=simulada` e `VIVA_PERMITIR_IA_SIMULADA=1`.
As respostas saem rotuladas como simuladas e isso é bloqueado em produção.
