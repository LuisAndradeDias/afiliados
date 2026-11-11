# MELI-13 — armazenamento separado de preço geral (pré-homologação)
Data: 11/11/2026 | Branch: feat/meli13-historico-marketplace-separado-20261111

## Motivação
O Histórico Inteligente MELI-11 separa Pix/cartão e exige disponibilidade confirmada para os indicadores de preço. O adaptador offline MELI-12 interpreta `sale_price?context=channel_marketplace`, que **não comprova Pix, cartão, estoque nem uma oferta publicável**. Não podemos converter esse retorno na modalidade errada.

## Novo módulo
`src/historico/preco-geral-marketplace.ts`

- Tabela aditiva `meli13_preco_geral`. Não usa `ALTER TABLE`, `DROP TABLE` ou migração destrutiva das tabelas anteriores.
- Persiste somente observações já normalizadas pelo adaptador MELI-12 com `contexto=channel_marketplace`, `modalidadePagamento=nao_informada`, `disponibilidade=indeterminada`, `podePublicar=false` e `podeCompararComoDesconto=false`.
- Cada linha preserva item, vendedor, variante, observação UTC, referência oficial UTC, preço em centavos, preço regular opcional e referência documental de autorização. Não grava tokens, senha, cookie, headers ou resposta bruta.
- Chave de idempotência distingue autorização/fonte, item, vendedor, variante, contexto e instante; cotação igual não duplica; divergências do mesmo instante recusam todo o lote por transação.
- Exige permissão documental revisada (objeto declarativo que **não substitui confirmação efetiva do Mercado Livre**); rejeita licença vencida, fonte divergente, amostras antigas/futuras, preços inválidos e dados fora do contrato.
- Retenção configurável de 1 a 90 dias e exclusão por revogação de concessão, mesmo depois de vencida.
- Limite de 80 amostras por lote; leitura de no máximo 80 itens e 100 pontos por item. Sem conexão com rede, agendador, Central, API local, cupons ou WhatsApp.

## Escopo dos testes
`npm run test:meli13`: sem permissão, expiração, escopo falso, precisão, semântica do preço, idempotência, conflitos/rollback, separação comercial, persistência e compatibilidade com tabela MELI-11, revogação, retenção e limites.

`npm run typecheck` e regressões MELI-12/11/10E e UX continuam obrigatórias. GitHub Actions executará o novo teste.

## Limitações e próximos passos
- **Não há fonte oficial autorizada de preços de terceiros confirmada para o APP_ID do projeto.** Coleta real continua bloqueada. Os testes são exclusivamente fixtures locais.
- Permissão precisa de procedimento externo de revisão e evidência: nenhum JSON ou flag autoemitida comprova a liberação. Antes de operação, vincular consentimento/escopo a verificação independente e política de revogação.
- O módulo ainda não é importado pelo `server.ts` e **não é implantado em produção** nesta fase; a Central permanece MELI-11 sem fonte e mostrando zero dados reais.
- A próxima homologação deve incluir migração reversível no arquivo de banco escolhido, backup, concorrência, limpeza de retenção em serviço independente, UX diferenciada de 'Preço geral' e contrato de leitura protegido; jamais publicar oferta automaticamente.
- Não implementar transporte HTTP até suporte Mercado Livre confirmar escopo, taxas e condições de retenção para terceiros no Programa de Afiliados.

Documentação oficial: https://developers.mercadolivre.com.br/devcenter/api-de-precos
