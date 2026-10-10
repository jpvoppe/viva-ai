# Segurança e privacidade

## Modelo

- **Chaves:** IA, Stripe e chave de serviço do Supabase ficam só no servidor (`src/lib/env.ts` com
  `server-only`; o build quebra se um componente de navegador importar).
- **Acesso a dados:** RLS em todas as tabelas (veja `docs/BANCO.md`). Testado em
  `tests/integration/seguranca-dados.test.ts` e `tests/e2e/isolamento.spec.ts` com dois usuários reais.
- **Entrada:** tudo que chega do navegador é validado com zod no servidor.
- **Arquivos:** pasta privada, um diretório por usuário, tipo conferido pelo conteúdo, tamanho por plano,
  acesso por link temporário.
- **Abuso:** limite diário por plano, limite de frequência, teto de gasto diário.
- **Cabeçalhos:** CSP, HSTS, bloqueio de iframe, `nosniff`, política de referência e de permissões
  (`next.config.ts`).
- **Administração:** papel gravado no banco, alterável só por SQL. O painel mostra totais, não conteúdo de
  conversas, e registra as ações do administrador em `admin_audit_log`.
- **Redirecionamento:** só para caminhos internos (`safeInternalPath`).

## LGPD

- Cadastro pede aceite dos Termos e da Política de Privacidade.
- Configurações → Privacidade: baixar todos os dados (JSON) e excluir a conta. A exclusão apaga dados e
  arquivos e cancela a assinatura no Stripe.
- Memória: nada é guardado sem a pessoa salvar; ela vê, edita, pausa e apaga cada item.
- Os textos de `/termos` e `/privacidade` são um ponto de partida e **precisam de revisão de advogado**.
  Os dados da empresa vêm de `NEXT_PUBLIC_EMPRESA_NOME`, `NEXT_PUBLIC_EMPRESA_CNPJ` e `NEXT_PUBLIC_CONTATO_EMAIL`.

## Pontos conhecidos

- A CSP permite `'unsafe-inline'` em scripts e estilos (exigência atual do Next.js sem nonce). Endurecer com
  nonce é melhoria futura.
- A idade é declarada pela pessoa; não há verificação de documento.
- `npm audit` (produção): 3 avisos moderados, todos na cadeia `mammoth → argparse → sprintf-js` (leitura de
  DOCX). O trecho vulnerável é o analisador de linha de comando, que o app não usa. Os 5 avisos altos são de
  ferramentas de desenvolvimento (eslint) e não vão para produção.
