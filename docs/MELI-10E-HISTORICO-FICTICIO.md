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

## Registro da auditoria inicial preservado (10/11/2026)
- Acer online; instalacao de producao em C:\projeto02 encontrada sem repositorio Git local.
- Portas 3030 e 3040 sem listener na primeira vistoria; rotas da Central nao responderam.
- Flags ALTERNATING_MONITOR_ENABLED, MERCADOLIVRE_MONITOR_ENABLED e WHATSAPP_AUTO_SEND_ENABLED habilitadas no .env; nao iniciar monitores automaticamente.
- Arquivos de mensagem e pacote de oferta anteriores presentes. Nenhum conteudo de contatos ou credenciais foi copiado para o repositorio.
- PRs #67 a #70 integrados, HEAD principal naquela vistoria 4b36a266; cinco arquivos criticos da instalacao correspondiam aos arquivos da branch local de origem.
- Conector 02 na versao 0.4.6; backup previo ao PR #70 identificado.
- Prototipos MELI-10B/C/D nao estavam incorporados a main nem localizados em zip sob Projeto04.
- A entrega inicial da fase MELI-10E teve quatro testes ficticios aprovados e typecheck sem erros. A presente revisao amplia para sete testes e adiciona verificacoes de confiabilidade.
- A recuperacao da Central, historico real e liberacao de consulta ao anuncio continuam independentes deste modulo experimental.

## Etapa de UX aprovada (11/11/2026)
- Pagina demonstrativa em `GET /historico-precos`, integrada ao menu unificado da Central e ao atalho da pagina inicial.
- Assets estaticos por allowlist: `/central/assets/historico-precos.css` e `/central/assets/historico-precos.js`.
- Graficos e indicadores com somente quatro itens DEMO-ML ficticios, com data de referencia simulada 11/11/2026.
- Filtros Pix/cartao e 7/30/90 dias, pesquisa local, selecao de item e apresentacao de dados insuficientes/indisponiveis.
- Nenhuma chamada a /api/status, /api/action, /items/{id}, OAuth ou monitor para carregar a pagina.
- Politica CSP sem conexoes de rede: `connect-src 'none'`; scripts e estilos apenas do proprio servidor.
- Nenhum botao de enviar ou publicar, nunca aprova oferta, comissao, preco real ou disponibilidade comercial.
- Teste visual automatizado: `npm run test:meli10e-ui`, nas larguras 1595, 768 e 390; screenshot com dados totalmente sinteticos em `test-results/meli10e-ui`.
- A pagina usa objetos ficticios JavaScript para demonstracao; nao consulta o modulo SQLite e nao alimenta historico operacional.
- O backend, os envios, as credenciais, os programas de afiliados e os bancos de producao permanecem sem alteracoes.
- A integracao real dependera de fontes expressamente autorizadas e de homologacao de privacidade/retencao.

## UX-04: regressão de altura da sidebar corrigida (11/11/2026)
- Falha identificada pela captura integral do operador: a sidebar fixa tinha altura limitada a 100vh e o restante do documento aparecia cinza claro em x=20 abaixo da janela.
- Regressão reproduzida antes da correção: screenshot real do Chrome, pixel RGB (245, 247, 251), esperado RGB (23, 35, 51) na faixa lateral do rodape.
- Correcao na casca visual compartilhada `unified-nav.css`: trilho navy e divisor de 1px pintados na altura inteira do documento; sidebar fixa e seu comportamento durante rolagem preservados.
- Pagina `historico-precos.css`: o background foi alterado de shorthand para background-color, evitando sobrescrever o trilho em páginas que carregam CSS posteriormente.
- Em resolucoes moveis ate 860px o trilho é explicitamente removido, mantendo o menu recolhivel.
- `tests/meli10e-historico-ui.mts`: pixel real do PNG full-page nas larguras 1595 e 1280, verificando o fundo até o rodapé. Testes interativos e navegação continuam.
- `tests/ux-shell-pixel.mts`: contrato expandido para checar background-image em todas as cinco telas, quatro larguras, além das geometrias e pixels existentes.
- Regressoes visuais precisam ser inspecionadas com o PNG inteiro, não apenas no viewport inicial.
- Produção `C:\projeto02` continua preservada; nenhuma ação em API, fila ou WhatsApp.
