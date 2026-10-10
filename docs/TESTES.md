# Testes

| Comando | Tipo | Precisa de |
|---|---|---|
| `npm run typecheck` | Tipos | nada |
| `npm run lint` | Estilo e regras do React | nada |
| `npm test` | Unitários (regras, datas, IA, arquivos, custos, componentes) | nada |
| `npm run test:integration` | Banco de verdade: RLS, limites, atividade, webhook de cobrança | Supabase de teste |
| `npm run test:e2e` | Navegador de verdade, computador e celular (360 px) | Supabase de teste + IA simulada + `npm run build` |

## Ambiente de teste

Os testes de integração e de navegador **criam e apagam usuários**. Por segurança, só rodam contra um
Supabase em `localhost`. Para apontar para um projeto remoto de teste (nunca o de produção), defina
`VIVA_TESTES_EM_BANCO_REMOTO=1`.

Jeito mais simples: Supabase local com a CLI (`supabase start`, precisa de Docker) e, no `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave anon local>
SUPABASE_SERVICE_ROLE_KEY=<chave service_role local>
AI_PROVIDER=simulada
VIVA_PERMITIR_IA_SIMULADA=1
```

Os testes de navegador leem o e-mail de confirmação num coletor local em `http://127.0.0.1:54321/_mail`.
Com a CLI do Supabase o coletor é outro (Mailpit/Inbucket); ajuste `tests/e2e/helpers.ts` se usar a CLI.

## O que os testes de navegador cobrem

Cadastro, login, recuperação de senha, boas-vindas, conversa (enviar, parar, regenerar, copiar, avaliar,
anexar, renomear, excluir, buscar), organizador, ferramentas de criação, estudo, projetos, configurações,
memória, exportação e exclusão de conta, isolamento entre dois usuários, páginas públicas, acessibilidade
automática (axe, claro e escuro), teclado e foco, e ausência de rolagem lateral em 320/360 px.

## O que nenhum teste automático cobre aqui

Veja `docs/LIMITACOES.md`: IA real, Stripe real, envio real de e-mail, voz, aparelhos reais.
