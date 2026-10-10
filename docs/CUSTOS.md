# Custos de IA

## O que é medido

Cada chamada à IA grava em `usage_events`: usuário, finalidade, modelo, tokens de entrada e de saída e
custo estimado. O painel `/admin` mostra os totais por dia, por modelo e por plano.

O custo é **estimado**: tokens × preço por milhão do modelo. O app conhece o preço do modelo padrão
(US$ 1 entrada / US$ 5 saída por milhão, valor a conferir no site do provedor). Para outros modelos, informe
`AI_PRECOS_JSON`; sem preço, o painel mostra "não calculado". A fatura do provedor é a fonte oficial.

## Travas

| Trava | Onde ajustar |
|---|---|
| Mensagens, gerações e arquivos por dia, por plano | `src/lib/plans.ts` |
| Tamanho de mensagem, de resposta e de contexto por plano | `src/lib/plans.ts` |
| Limite de frequência (rajadas) por usuário | `src/lib/limits/rate-limit.ts` |
| Teto diário de gasto, para o app inteiro | `AI_ORCAMENTO_DIARIO_USD` |
| Desligar módulos na hora | `/admin` → chaves de recurso |

## Valores atuais são provisórios

Os limites em `src/lib/plans.ts` (Gratuito: 15 mensagens, 5 gerações e 3 arquivos por dia; pagos: 150, 60
e 30) são valores iniciais de segurança, **não** uma decisão comercial. Para definir preço e limite com dado:

1. Rode um período com usuários reais no Gratuito.
2. No `/admin`, veja o custo médio e o custo dos 10% que mais usam, por plano.
3. Preço do plano precisa cobrir o custo do usuário pesado mais a taxa do Stripe, com margem.
