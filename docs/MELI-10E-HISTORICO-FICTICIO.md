# MELI-10E: historico experimental SQLite, sem acesso real
Data: 10/11/2026. Branch: feat/meli10e-historico-simulado-20261110.

## Escopo
- Modulo experimental: src/fontes/mercadolivre/historico-ficticio.ts.
- Exclusivamente observacoes ficticias ("fixture"). Nao usa conta real, token, API, navegador, perfis, WhatsApp ou jobs da Central.
- Nao substitui o historico-antiduplicado existente e nao esta conectado a nenhum painel.
- O acesso a anuncios de terceiros continua negado pelo endpoint GET /items/{id} (403 confirmado em 10/11). Um chamado oficial foi respondido com a evidencia.

## Regras de confianca testadas
- Identidade comercial separa item, vendedor, variante, pagamento (Pix/cartao), moeda e contexto.
- Dados com disponibilidade "indeterminada" ou "indisponivel" ficam registrados para auditoria, mas nao alteram preco minimo, maximo, mediana ou contagem de amostras confirmadas.
- Uma observacao posterior sem disponibilidade confirmada invalida o campo "ultimoCentavos" e desabilita o indicador.
- Sao necessarios >= 3 dias UTC distintos, observacoes confirmadas dentro de janela de 30 dias e registro mais recente confirmado ha no maximo 24 horas.
- Esse indicador significa somente base estatistica suficiente para uma futura analise. Nao prova desconto, atribuição de afiliado, estoque, cupom, compra ou autorizacao de envio.
- Observacoes repetidas (mesmo item/contexto/instante/preco/estado) sao idempotentes. Uma observacao com mesmo instante e preco/estado divergente gera conflito sem sobrescrever a amostra original.
- Datas UTC impossiveis, observacoes no futuro, valores incorretos, contexto incompleto e qualquer fonte distinta de "fixture" sao recusados.
- Persistencia entre fechar e reabrir SQLite foi testada usando exclusivamente arquivo temporario criado pelo teste.

## Validacao
- npm run test:meli10e (fixtures, armazenamento temporario; SEM API real).
- npm run typecheck.
- CI da branch em PR #71; revalidar apos alteracoes.
- Nenhuma coleta automatica foi habilitada, nenhum dado real armazenado e nenhum deploy aplicado.

## Antes de integrar qualquer dado de producao
- Confirmar por documentacao/retorno oficial quais fontes de precos e condicoes de retencao sao autorizadas.
- Projetar migrations e rollback de banco com backup; politica de retencao; auditoria de fonte/autenticidade, controles de concorrencia e limites.
- Definir como confirmar disponibilidade e separar preco Pix/cartao, sem inventar promoções.
- Implementar UX de historico somente-leitura, com ausencia de dados e causas explicitas.
- Regressao e homologacao visual, backup SHA-256, codigo revisado, CI verde e nenhuma tarefa de envio pendente.
