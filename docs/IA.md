# IA

## Como funciona

O navegador nunca fala com o provedor de IA. Ele chama as rotas do servidor (`/api/chat`, `/api/generate`,
`/api/generate/structured`), que conferem login, plano, limite diário, limite de frequência e orçamento,
montam o contexto e só então chamam o provedor. A chave fica só no servidor.

Código: `src/lib/ai/`. Cada provedor implementa a mesma interface (`AiProvider.stream`), então trocar de
provedor não muda o resto do app.

| Provedor | Como ativar |
|---|---|
| Anthropic (padrão) | `ANTHROPIC_API_KEY` |
| Compatível com OpenAI | `AI_PROVIDER=openai-compat` + `OPENAI_COMPAT_API_KEY`, `OPENAI_COMPAT_BASE_URL`, `AI_MODEL_PADRAO` |
| Simulada (dev/teste) | `AI_PROVIDER=simulada` + `VIVA_PERMITIR_IA_SIMULADA=1` — bloqueada em produção |

Modelo padrão: `claude-haiku-4-5-20251001` (troque com `AI_MODEL_PADRAO`). Se `AI_MODEL_AVANCADO` estiver
definido, os planos pagos usam esse modelo.

Sem credencial, as telas mostram "IA não configurada". Não existe resposta de mentira.

## O que entra no contexto

Instruções do VIVA (tom, idioma, proteções por faixa etária), preferências da pessoa, memórias que ela
mesma salvou e deixou ativas, o projeto vinculado, o texto extraído dos anexos e o trecho mais recente da
conversa — tudo cortado conforme o plano (`src/lib/plans.ts`).

## Proteções

- Menores de 18 (pela data de nascimento informada) recebem instruções mais restritivas.
- Texto de anexo é tratado como dado, não como instrução.
- Limite de tamanho de mensagem, de resposta e de contexto por plano.
- Pesquisa na web: desligada por padrão (chave `pesquisa_web` no painel). Gera custo extra e
  **não foi testada com a API real**.

## Arquivos

Aceitos: PDF, DOCX, TXT, MD, CSV e imagens (PNG, JPEG, WebP, GIF). O tipo é conferido pelo conteúdo do
arquivo, não só pela extensão. PDF escaneado (só imagem) não tem texto para extrair.
