# Etapa 53 - confiabilidade de precos, anuncios e estoque

**Inicio:** 28/10/2026 | **Branch:** `feat/etapa50-homologacao-segura`
**Escopo:** Mercado Livre (com a Amazon e Shopee preservadas).
**Estado:** validacao funcional em desenvolvimento. Nao habilitar autoenvio.

## 1. Evidencia real que motivou esta etapa

O usuario abriu em 28/10/2026 o produto `MLB38053317`
(parafusadeira e furadeira The Black Tools TB-21PW).
A captura mostra MAIS DE UMA condicao de compra, por exemplo:

| Opção observada na captura | Valor e condicao |
| --- | --- |
| Melhor preco | R$ 140,60 **no Pix** |
| Parcelado (mesmo bloco de oferta) | R$ 148,00 **4 x R$ 37,00**, outros cartoes |
| Loja oficial The Black Tools (outro bloco) | R$ 179,90 |
| Estoque | "Estoque disponivel" exibido na pagina |

**Importante:** sao valores visuais pontuais. A captura nao revela
o `seller_id` nem comprova que o API `price` tenha a mesma
condicao de Pix. Nao confundir a loja oficial com o vendedor da
opcao mais barata. A pagina do catalogo nao prova comissao.

## 2. Falhas evitadas

1. **Concorrente com maior OFF diferente do vencedor:**
   o sistema anterior classificava e escolhia um candidato da lista
   por desconto antes de saber quem ganhava a pagina `/p/`.
   A nova selecao consulta `/products/{produtoId}`, identifica
   `buy_box_winner`, confronta anuncio, vendedor, preco e estoque,
   e SO ENTAO verifica reputacao verde do mesmo vendedor.
2. **Catalogo sem quantidade publicada:** se a lista `/items` nao
   trouxer `available_quantity`, o vencedor oficial com quantidade
   inteira positiva pode comprovar a disponibilidade. Sem quantidade
   no vencedor, rejeitar. Sem item na lista, utilizar a ficha
   `buy_box_winner` SOMENTE se trouxer condicao `new`,
   vendedor, preco, item e estoque completos e nao contradizer
   uma listagem existente. Nao presumir condicao.
3. **Troca de vendedor ou preco:** diferenca de 1 centavo, ID do
   vendedor ausente/divergente, item perdedor ou moeda declarada
   diferente de BRL bloqueiam a oferta. Validacao exige precos
   com no maximo dois decimais e quantidades inteiras.
4. **Porcentagem inflada:** desconto anunciado arredondado para
   BAIXO, nunca para cima. Original_price precisa pertencer ao
   vencedor e ser valido; nao misturar referencia de concorrente.
5. **Pix/cartao enganoso:** a API prova o preco do anuncio vencedor,
   mas nao prova modalidade ou promocao especifica de pagamento.
   A oferta guarda `precoFonte=catalogo-vencedor-api`,
   `precoCondicaoPagamento=nao-verificada`, timestamp da leitura.
   A mensagem mostra **Preco informado no catalogo**, nao
   "Por R$... no Pix", e pede confirmacao do pagamento, vendedor
   e estoque. Nao inventa parcela, cupom ou beneficios de conta.
6. **Trocas ate o clique:** as rotinas existentes reconsultam
   `/products/{id}` antes de preparar ou enviar a mensagem.
   O novo comparador tambem recusa vendedor ausente,
   moeda incorreta, centavos invalidos e quantidade fracionada.

## 3. Matriz de testes locais sem rede real

- Concorrente 111: R$ 140,60 e maior percentual; vencedor 222:
  R$ 148,00. Escolher APENAS vencedor 222; consultar reputacao 222.
- Vencedor nao verde mesmo com concorrente verde: bloquear.
- Vencedor ausente da lista + ficha oficial completa: recuperar
  com segurança; ficha incompleta: bloquear.
- Listagem que contradiz a ficha: bloquear, sem usar fallback.
- Estoque zero ou ausente, preco divergente, seller_id trocado,
  moeda USD, 148.005, vendedor 222.5 ou quantidade 1.2: bloquear.
- Antes de envio: cambio de vendedor/valor/estoque no buybox
  invalida a oferta.
- Mensagem ML nunca divulga valor de outro vendedor nem inventa
  "no Pix" ou parcelamento.
- Protecoes existentes de cupom e de deduplicacao sao preservadas.

## 4. Limitacoes declaradas

**Nao fizemos compra, aplicacao de cupom real, checkout real nem envio.**
A API nao comprova, por si so, o preco Pix, o valor final de cartao,
taxas, frete, elegibilidade regional ou beneficios da conta.
Um preco observado em uma captura pode mudar. Sinalizacoes do
usuario na pagina nao substituem verificacao automatizada de
vendedor, modalidade e estoque no instante de publicacao.

O objetivo desta entrega e tornar a selecao do vendedor correta e
impedir precos falsamente vinculados ao mesmo anuncio. Antes de
publicar, ainda sera necessario homologar a modalidade de pagamento
e qualquer cupom na pagina do produto com evidencia especifica.
Se a prova nao existir: destacar o preco como **condicional** ou
bloquear a campanha, jamais prometer preco Pix universal.

## 5. Condicoes para liberacao

- Testes unitarios, integracao e TypeScript aprovados localmente e
  no GitHub Actions.
- Backup/rollback de arquivos tocados, sem alterar segredos.
- Nenhum autoenvio, monitores, campanhas ou novas filas ativadas.
- Comparacao manual do vendedor/anuncio e forma de pagamento em
  um produto com mais de uma opcao, antes da homologacao comercial.
- Relatorios oficiais para avaliacao de comissao, separada de preco.
- Revisar conformidade dos canais de divulgacao do afiliado.

## 6. Fontes de referencia da API

Documentacao oficial Mercado Livre, `/products/{id}`,
`buy_box_winner` com `item_id`, `seller_id`, `price` e quantidade:
https://developers.mercadolivre.com.br/pt_br/produto-consulta-de-usuarios/concorrencia-em-catalogo

Documentacao de precos e promocoes, incluindo diferenca entre
valor da oferta, referencia e condicoes:
https://developers.mercadolivre.com.br/pt_br/servicos-gerenciamento-de-contatos/api-de-precos
