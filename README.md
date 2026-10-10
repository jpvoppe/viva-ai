# VIVA AI

O assistente inteligente para a vida cotidiana: conversa com IA, organizador (tarefas, listas, metas),
ferramentas de criação, estudo (cartões e questionários), projetos, histórico, memória controlada pelo
usuário, planos de assinatura e painel administrativo.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Motion · Supabase (Postgres,
login, arquivos, RLS) · Stripe · provedor de IA configurável (Anthropic por padrão).

## Começar

```bash
npm install
cp .env.example .env.local   # preencha as chaves (veja docs/INSTALACAO.md)
npm run dev                  # http://localhost:3000
```

Sem Supabase configurado, o app abre a tela "configuração pendente". Sem chave de IA, o assistente avisa
que a IA não está configurada — ele nunca inventa resposta.

## Documentação

| Documento | Assunto |
|---|---|
| [docs/INSTALACAO.md](docs/INSTALACAO.md) | Passo a passo: Supabase, variáveis, primeiro administrador |
| [docs/BANCO.md](docs/BANCO.md) | Tabelas, regras de acesso (RLS), migrações |
| [docs/IA.md](docs/IA.md) | Provedores, modelos, limites, proteções |
| [docs/PAGAMENTOS.md](docs/PAGAMENTOS.md) | Stripe: produtos, webhook, teste |
| [docs/CUSTOS.md](docs/CUSTOS.md) | Como o custo de IA é medido e controlado |
| [docs/SEGURANCA.md](docs/SEGURANCA.md) | Modelo de segurança e LGPD |
| [docs/TESTES.md](docs/TESTES.md) | Como rodar os testes e o que eles cobrem |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Publicação e checklist |
| [docs/LIMITACOES.md](docs/LIMITACOES.md) | O que ainda não foi validado ou não existe |

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Desenvolvimento |
| `npm run build` / `npm run start` | Versão de produção |
| `npm run typecheck` / `npm run lint` | Verificação de tipos e de estilo |
| `npm test` | Testes unitários |
| `npm run test:integration` | Testes de banco, limites e cobrança (precisa de Supabase de teste) |
| `npm run test:e2e` | Testes no navegador (precisa de Supabase de teste + IA simulada) |

## Estrutura

```
src/app          páginas e rotas de API
src/features     regras de cada módulo (chat, organizador, criar, estudo, projetos, ...)
src/components   componentes visuais e sistema de design
src/lib          IA, limites, cobrança, arquivos, Supabase, planos
supabase/        migrações SQL (esquema, regras de acesso, arquivos)
tests/           unit, integration, e2e
```
