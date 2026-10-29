# Etapa 56 — auditoria oficial por anuncio sem buy box

Data: 29/10/2026. Projeto: Caça Promos VIP.

## Escopo e resultado esperado

O catalogo `MLB38053317` apareceu visualmente em pagina oficial
com opcoes de preco, mas `GET /products/MLB38053317` retornou
`buy_box_winner=null`. A Etapa 55 identificou 32 publicacoes
listadas e nenhuma com quantidade exposta.

A Etapa 56 adiciona uma auditoria **manual e somente leitura** para
verificar UM `item_id` especifico, sem que isso conceda status de
vendedor vencedor, disponibilidade para todo comprador ou direito
a comissao.

O usuario enviou anteriormente URL com anuncio de referencia
`MLB3771505959`. O uso deste ID neste diagnostico nao comprova
que ele seja a opcao de menor preco nem o anuncio da loja oficial.

## Fonte e restricoes oficiais

- `GET /items/{item_id}` retorna, conforme permissoes, id, vendedor,
  catalog_product_id, condicao, preco, status, permalink, etc.
- A documentacao oficial informa que `available_quantity` de anuncio
  de terceiro pode ser omitido, sendo reservado ao vendedor owner.
- `GET /items/{item_id}/sale_price?context=channel_marketplace`
  pode informar o preço calculado no canal, mas **nao** identifica
  a modalidade Pix/cartao, elegibilidade do comprador ou cupom.
- Sem `buy_box_winner`, a listagem de /items nao prova a opcao
  que a pagina de catalogo escolheria.
- Resposta 401/403/429/5xx interrompe, nao tenta contornar
  permissoes e nao faz varias consultas em rajada.

Fontes:
https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao/publicacao-de-produtos
https://developers.mercadolivre.com.br/pt_br/produto-consulta-de-usuarios/concorrencia-em-catalogo
https://developers.mercadolivre.com.br/pt_br/produto-consulta-de-usuarios/permissoes-funcionais
https://developers.mercadolivre.com.br/pt_br/api-docs-pt-br/pxq-porcentagem-b2b

## Fluxo do diagnostico

Arquivo `src/fontes/mercadolivre/auditoria-anuncio-direto.ts`.

1. Preflight manual do CLI: Central 3030 pausada, monitores e envio
   automatico desligados e nenhum job de links em execucao.
2. Consulta oficial `GET /products/{produtoId}`.
3. Se a buy box existir, o anuncio solicitado precisa ser ela,
   senao `ANUNCIO_SOLICITADO_NAO_EH_VENCEDOR_OFICIAL`.
4. Se a buy box estiver nula e um anuncio for informado, chama
   `GET /items/{anuncioId}` com o token autorizado.
5. Confere: `item.id` exato, `catalog_product_id` correspondente,
   seller_id inteiro positivo, status ativo, condicao novo,
   preco em centavos, moeda BRL e permalink HTTPS oficial.
6. Se a verificacao basica permitir, faz NO MAXIMO um GET
   `/items/{anuncioId}/sale_price?context=channel_marketplace`.
   Compara valor em centavos, exige moeda BRL e data recente
   (ate 10 minutos); divergencia e informativa, NUNCA libera envio.
7. O resultado e sanitizado: nao exporta seller_id, tokens,
   cookies, URL completa do item nem link rastreado.

**Modo de teste de item:**

```powershell
cd C:\projeto02
node --import tsx src/robo/mercadolivre-preco-diagnostico.ts MLB38053317 MLB3771505959
```

Na ausencia de `anuncioId`, segue a Etapa 55 e classifica
publicacoes sem buy box; nao consulta automaticamente todas
as 32.

## Interpretacao da evidencia

- `situacao=anuncio_vinculado_pendente`: item ativo e associado
  ao catalogo, mas vencedor da PDP continua NAO confirmado.
- `estoque=nao_exposto`: a API omitiu quantidade, nao equivale
  a `declarado_zero`.
- `precoCanalStatus=coerente`: apenas o preco marketplace coincide
  com a ficha do item, nao comprova Pix.
- `precoCanalStatus=divergente`: precos diferentes entre
  ficha e canal; nenhuma auto-correcao nem divulgacao.
- `ANUNCIO_PERMISSAO_NEGADA`: permissao insuficiente; nao tentar
  navegador anonimo ou trocar usuario para contornar.
- `catalogoCorrespondente=false`: publicacao nao comprovada
  como associada ao produto pesquisado.

**Garantias obrigatorias e constantes em TODOS os resultados:**
`vendedorVencedorConfirmado=false`,
`modalidadePagamentoConfirmada=false`,
`cupomAplicavelConfirmado=false`,
`atribuicaoComprovada=false`, `envioPermitido=false`.

A Etapa 56 NAO altera as travas de preparacao, fila, cupons,
geracao de links nem o envio de WhatsApp. Nao edita extensao,
credenciais ou perfil pessoal.

## Regras do programa de afiliados: pendencia independente

A elegibilidade dos canais e disputada nas paginas oficiais
do Mercado Livre; algumas aceitam WhatsApp/Telegram **publicos**
e proíbem grupos privados, outras proibem aplicativos de
mensagens em termos amplos. Para qualquer campanha, confirmar
as regras atuais da conta e o canal cadastrado com suporte/
termos vigentes. Nunca assumir pagamento de comissão porque o
link abre no produto.

Nao fazer compras pelos proprios links nem cliques artificiais.
Nao publicar valores ou cupons nao comprovados.

## Testes

Cobrir: objeto de item completo, estoque omitido, preco em contexto
coerente/divergente, seller ausente, condicao usada, status paused,
catalogo errado, permalink externo ou HTTP, preco com 3 casas,
moeda USD, estoque zero/positivo, 401/403/404/429/500,
JSON invalido, referencia antiga, rede fora e CLI sem efeitos.
Implementar via fakes, sem compras.

Implantar apenas depois de CI completo e backup SHA-256,
mantendo a Central pausada.

## Resultado real de 29/10/2026 — referencia MLB3771505959

A maquina ACER foi reiniciada pelo Windows em 29/10/2026
às 08:07 -03: as portas 3030 e 3040 estavam offline.
A restauração ocorreu manualmente, sem configurar
inicializacao automatica, com Central pausada, sem
WhatsApp e sem monitores (PIDs conferidos).

Uma consulta supervisionada (somente GET) utilizou
catalogo MLB38053317 e anuncio especifico MLB3771505959.
O token autorizado foi renovado pelo mecanismo existente.
Resultado sanitizado, **sem IDs de vendedor nem tokens**:
- Catalogo existente e ativo.
- `buy_box_winner` ausente.
- GET /items/{anuncioId} negado com `403`.
- `ANUNCIO_PERMISSAO_NEGADA`, `inconclusivo`.
- Nao houve consulta `sale_price` porque a ficha do item
  nao pôde ser validada.
- Estoque, preco do anuncio, modalidade Pix/cartao,
  cupom, atribuicao e elegibilidade comercial
  permaneceram NAO COMPROVADOS.
- `envioPermitido=false`; sem compras, sem postagens
  e sem envio de WhatsApp.

A resposta 403 e um **limite autorizado da API**,
nao motivo para usar tokens de terceiros, buscar dados
privados por outra sessao ou ignorar as regras de afiliados.
Proxima tarefa: revisar acesso formal do aplicativo,
sem ampliar escopos sem necessidade, e definir prova
de disponibilidade e link por canal permitido.
