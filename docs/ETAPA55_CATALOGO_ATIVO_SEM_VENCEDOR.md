# Etapa 55 — catalogo ativo sem vendedor vencedor

Data: 28/10/2026. Branch: feat/etapa50-homologacao-segura.
Escopo: Mercado Livre, diagnostico de catalogo; preserva Amazon,
futura Shopee, Conector 02, Captação e WhatsApp desligados.

## Problema observado

O produto MLB38053317 abriu na pagina oficial e mostrou vendedor
e precos no navegador autorizado do usuario, mas o GET oficial
`/products/MLB38053317` retornou id correto, status=active,
e `buy_box_winner=null`. Isso nao prova estoque zero, nem prova
que a pagina esta errada: a API nao confirmou uma publicacao
vencedora apta para vincular a oferta ao catalogo.

Segundo documentacao oficial, uma pagina de produto pode ter
varias publicacoes associadas e `buy_box_winner` identifica
quem ganha a competicao. Quando nenhuma publicacao de catalogo
esta competindo, o campo pode vir null. Publicacoes **listadas**
nao sao, por isso, comprovadamente vencedoras.

Referencia oficial:
https://developers.mercadolivre.com.br/pt_br/produto-consulta-de-usuarios/buscador-de-produtos
https://developers.mercadolivre.com.br/pt_br/produto-consulta-de-usuarios/concorrencia-em-catalogo
https://developers.mercadolivre.com.br/pt_br/produto-consulta-de-usuarios/api-de-precos

## Solucao investigativa e segura

Novo modulo `src/fontes/mercadolivre/investigacao-sem-vencedor.ts`
e integracao no diagnostico manual
`src/robo/mercadolivre-preco-diagnostico.ts`.

O diagnostico exige preflight completo: Central 3030 pausada, sem
autoenvio, monitores, tarefas ou jobs em andamento. Consulta:
1. `GET /products/{produtoId}` com token ja autorizado.
2. **Somente se** o catalogo estiver ativo, ID correto e
   `buy_box_winner` vazio, UMA leitura adicional de
   `GET /products/{produtoId}/items` para contagens anonimas.
3. Se o vencedor estiver presente, usa o caminho da Etapa 54,
   sem fazer a consulta adicional de `/items`.
4. Sem vencedor, o diagnostico **nunca** consulta `sale_price`,
   **nunca** escolhe a publicacao mais barata ou a unica
   retornada na lista como vencedora.
5. A resposta publica apenas observacoes agregadas, sem
   seller_id, item_id de terceiros, URLs de rastreio, tokens,
   cookies ou HTML.

Classificacoes de leitura de listagem:
- `NENHUMA_PUBLICACAO_OBSERVADA`: lista vazia nesta consulta;
  nao prova que o produto ficou sem estoque no site.
- `PUBLICACOES_SEM_VENCEDOR`: lista contem anuncios, mas a
  compra pelo link /p/ nao tem winner comprovado pela API;
  as publicacoes sao apenas pistas para revisao.
- `PUBLICACOES_DADOS_INCOMPLETOS`: dados listados insuficientes
  para comparar moedas, quantidade, condicao, preco e seller.
- `LISTAGEM_SEM_PERMISSAO`, `LISTAGEM_LIMITE_429`,
  `LISTAGEM_NAO_ENCONTRADA`, `LISTAGEM_HTTP_INDISPONIVEL`,
  `LISTAGEM_FORMATO_INVALIDO` e `LISTAGEM_REDE_INDISPONIVEL`:
  cada situacao preserva o estado pendente, sem repetir chamadas.
- Amostra limitada a 60 IDs de publicacao unicos; a contagem
  e da amostra observada, nao do total de anuncios da pagina.
- `vencedorConfirmado`, `precoConfirmado`,
  `estoqueNaPaginaConfirmado`, `cupomAplicavelConfirmado`
  e `envioPermitido` sao sempre **false** nesse diagnostico.

Na descoberta periodica de ofertas, o `MercadoLivreApiFonte`
tambem passa a registrar contador agregado
`catalogos-ativos-sem-vencedor`, sem gerar oferta e sem logar
ID de vendedor nesse motivo.

## Limites da evidencia

Nenhuma observacao de `/products/{id}/items` autoriza
envio ou prova vendedor vencedor; nem 1 unico item e suficiente.
A API de competicao por item (`/items/{id}/price_to_win?version=v2`)
pode dar pistas para publicacoes do vendedor, mas nao
substitui por si so `buy_box_winner` do catalogo. Ela nao sera
executada automaticamente nesta etapa.

A screenshot do usuario nao revela `seller_id` em relacao ao
preco no canal e nao prova que R$ 140,60 no Pix e R$ 148
parcelado pertençam ao mesmo seller ou a todos os compradores.
O modulo nao prova cupom, elegibilidade, frete nem comissao.

Para liberar oferta: exigir vinculo oficial de **mesmo catalogo,
item_id e seller_id**, estoque recente inteiro e positivo, preco
do canal coerente, modalidade de pagamento verificada e cupom
com comprovacao individual no checkout. Sem buy box, colocar
em revisao e manter WhatsApp bloqueado.

## Testes e auditoria

- Fakes de 0/1/3 vendedores e listagem duplicada/incompleta.
- Rejeitar estoque zero, valores com fraçao de centavo,
  vendedor invalido, item usado/pausado, moeda USD.
- Erros 401/403/404/429/500, JSON invalido e falha de rede.
- Nao repetir 429, nao buscar seller_id ou price em logs.
- Sem item no catalogo e com status divergente nao chamar rede.
- Testes existentes Etapas 53 e 54 continuam aprovados.
- GitHub Actions, TypeScript e backup SHA-256 obrigatorios
  antes da implantacao restrita.
- Sem compra, mensagem, publicacao ou alteracao no Chrome.
## Resultado da leitura real de 28/10/2026

Teste supervisionado e somente leitura de `MLB38053317`,
com Central pausada e token autorizado, sem navegador de
WhatsApp e sem escrita de oferta:

- `/products/{id}`: ID correspondente, `status=active`,
  `buy_box_winner=null`.
- `/products/{id}/items`: **32 publicacoes observadas**,
  **32 com dados minimos de item/vendedor/preco/condicao/status**;
  **0 com quantidade de estoque declarada positiva** na listagem.
- Classificacao: `PUBLICACOES_SEM_VENCEDOR`,
  `pendente_revisao`, `envioPermitido=false`.
- A ausencia de `available_quantity` na lista nao comprova
  estoque zero. A pagina vista pelo usuario mostrou estoque,
  mas nao trouxe os IDs tecnicos necessarios para conciliar
  os vendedores, o preco e a buy box.
- O teste nao invocou `sale_price` sem vencedor confirmado.
  Nao houve cupom, comissao, compra, publicacao nem WhatsApp.

Os numeros sao uma **observacao pontual** da API. Podem
mudar e nao comprovam disponibilidade atual em cada anuncio.
Nao atribuir R$ 140,60 (Pix), R$ 148,00 (parcelado) ou R$ 179,90
a qualquer vendedor individual sem evidencia adicional.
