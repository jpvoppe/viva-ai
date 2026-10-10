# Publicação

O app é um Next.js padrão: roda na Vercel ou em qualquer servidor Node (`npm run build && npm run start`).

## Vercel

1. Suba o repositório para o GitHub e importe na Vercel.
2. Cadastre as variáveis de `.env.example` em **Settings → Environment Variables**.
3. `NEXT_PUBLIC_SITE_URL` = domínio final, com `https://`.
4. Publique. Confira `https://seu-dominio/api/health` (deve responder `ok`).

## Checklist antes de abrir ao público

- [ ] Migrações aplicadas no Supabase de produção
- [ ] URLs de redirecionamento e modelos de e-mail ajustados (docs/INSTALACAO.md)
- [ ] SMTP próprio configurado no Supabase
- [ ] Confirmação de e-mail ligada no Supabase
- [ ] Chave de IA de produção e `AI_ORCAMENTO_DIARIO_USD` definidos
- [ ] `VIVA_PERMITIR_IA_SIMULADA` **ausente**
- [ ] Stripe: chaves de produção, preços, webhook e portal do cliente; uma compra real de ponta a ponta
- [ ] Dados da empresa preenchidos; Termos e Privacidade revisados por advogado
- [ ] Primeiro administrador criado; `/admin` conferido
- [ ] Limites dos planos revisados (docs/CUSTOS.md)
- [ ] Teste manual em celular real (Android e iPhone): cadastro, conversa, anexo, voz
- [ ] Backup do banco ligado no Supabase
