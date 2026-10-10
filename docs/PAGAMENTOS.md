# Pagamentos (Stripe)

Planos: **Gratuito**, **VIVA Plus** e **VIVA Família** (até 5 pessoas). O preço mostrado nas telas vem
sempre do Stripe; sem Stripe configurado aparece "preço a definir".

## Configurar

1. No Stripe, crie dois produtos com preço **recorrente**: VIVA Plus e VIVA Família.
   Copie os IDs dos preços (`price_...`) para `STRIPE_PRICE_PLUS` e `STRIPE_PRICE_FAMILIA`.
2. Copie a chave secreta para `STRIPE_SECRET_KEY` (comece com a de teste, `sk_test_...`).
3. Em **Developers → Webhooks**, crie um destino apontando para
   `https://seu-dominio.com.br/api/stripe/webhook` com os eventos:
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
   Copie o segredo de assinatura (`whsec_...`) para `STRIPE_WEBHOOK_SECRET`.
4. Ative o **Customer Portal** no Stripe (é por ele que a pessoa troca cartão e cancela).

Webhook: aviso que o Stripe envia ao nosso servidor quando algo acontece com a assinatura.

## Regras do código

- O plano **só muda pelo webhook**, com assinatura conferida. Voltar do checkout para o app não libera nada.
- Cada evento é registrado em `billing_events` e processado uma única vez (reenvio do Stripe não duplica).
- O servidor não confia no conteúdo do evento: relê a assinatura direto no Stripe antes de gravar.
- Pagamento falhou → a tela avisa e aponta o portal. Assinatura encerrada → volta ao Gratuito, sem apagar dados.

## Testar localmente

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use o cartão de teste `4242 4242 4242 4242`. Os testes automáticos (`tests/integration/cobranca-webhook.test.ts`)
usam um Stripe falso local; **o fluxo com a conta Stripe real ainda precisa ser validado** antes de cobrar.
