# Limitações conhecidas

## Não validado com serviço real

Tudo abaixo foi construído e testado com substitutos locais. Falta validar com as contas de verdade:

- **IA real.** Os testes usam a IA simulada e respostas gravadas do formato da Anthropic. Nenhuma chamada
  real foi feita. A pesquisa na web em especial nunca rodou contra a API.
- **Stripe real.** Checkout, portal e webhook foram testados contra um Stripe falso local.
- **Supabase na nuvem.** Testado num Supabase local montado à mão (mesmos componentes: Postgres, GoTrue,
  PostgREST, Storage). As migrações ainda não foram aplicadas num projeto da nuvem.
- **E-mail.** Entrega real, caixa de spam e modelos de e-mail do Supabase.
- **Voz.** Ditado e leitura em voz alta usam recursos do navegador e não rodam em teste automático.
  O ditado depende do navegador (não existe no Firefox, por exemplo).
- **Aparelhos reais.** Celular foi testado por emulação (360 px), não em Android/iPhone físicos.
- **Desempenho.** Sem medição de Web Vitals em produção.

## Não existe ainda

- Lembretes por notificação (push/e-mail). Tarefas têm data, mas o app não avisa fora da tela.
- Leitura de PDF escaneado (OCR).
- Outros idiomas: a estrutura aceita, mas os textos das telas estão em português dentro dos componentes,
  não em dicionários de tradução.
- Verificação de idade por documento: a idade é declarada.
- Convite de família por e-mail automático: o app gera o link e a pessoa compartilha.

## Provisório, depende de decisão

- Limites e benefícios de cada plano (`src/lib/plans.ts`) e os preços (cadastrados no Stripe).
- Textos jurídicos (`/termos`, `/privacidade`): precisam de advogado.
- CSP com `'unsafe-inline'` (veja docs/SEGURANCA.md).
