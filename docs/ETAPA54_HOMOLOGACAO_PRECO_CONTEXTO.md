# Etapa 54 - preço contextual por anúncio vencedor

Data: 28/10/2026.
Escopo: Mercado Livre; Amazon e Shopee inalteradas.
Premissa: Central sempre pausada, sem publicações, pedidos ou WhatsApp.

## Evidência e limites

A captura enviada pelo usuário do catálogo MLB38053317 mostrou
R$ 140,60 com indicação de Pix, R$ 148,00 parcelado e outra
oferta a R$ 179,90. Essa captura comprova apenas o que foi
exibido naquele navegador, naquele momento. Não associa esses
valores a seller_id/item_id individuais.

A documentação oficial do Mercado Livre confirma:
- GET /products/{id} -> buy_box_winner.item_id, seller_id, price,
  currency_id, available_quantity, condition.
- GET /items/{item_id}/sale_price?context=channel_marketplace
  -> amount, currency_id, reference_date para o canal. O contexto
  pode também depender do nível do comprador.
- GET /items/{item_id}/prices -> context_restrictions, valores
  standard/promotion; pode haver restrições de canal, fidelidade
  e quantidade. A plataforma pode ocultar dados sem permissão.
- O frontend pode recalcular/apresentar condições diferentes das
  consultadas programaticamente (FAQ oficial maio/2026).

Fontes:
https://developers.mercadolivre.com.br/pt_br/produto-consulta-de-usuarios/concorrencia-em-catalogo
https://developers.mercadolivre.com.br/pt_br/produto-consulta-de-usuarios/api-de-precos
https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao/promocoes-precificacao
https://developers.mercadolivre.com.br/pt_br/precos-por-quantidade

## Regra de homologação

1. Validar catálogo ativo, item vencedor, mesmo vendedor, moeda
   BRL, valor em centavos e estoque inteiro positivo (Etapa 53).
2. Fazer UM único GET de preço do item vencedor no contexto
   channel_marketplace, sem repetir HTTP 429.
3. Comparar o `amount` em centavos com o valor do item vencedor.
   - Exatamente igual, reference_date recente: "coerente".
   - Diferente mesmo por R$ 0,01: "divergente" e BLOQUEAR.
   - Falta de permissão, timeout, HTTP 429, moeda diferente,
     centavos inválidos ou data antiga: "inconclusivo" e BLOQUEAR.
4. Não reescrever automaticamente `precoAtual`. Se preço mudou,
   recomeçar descoberta, verificar o novo vencedor e atualizar o
   vínculo com a nova observação.
5. Nunca promover "coerente" a "Pix garantido", "4x", "cupom
   aplicável", "frete garantido" ou "comissão comprovada".
   O endpoint sale_price não confirma esses detalhes.
6. Confirmar cupom do próprio produto e anúncio no checkout
   antes de anunciar. Cupons encontrados em campanhas são apenas
   candidatos e jamais alteram preço, score ou mensagem sozinhos.

## Onde a trava foi integrada

- `src/painel/server.ts`: geração de link mantém a validação
  de estoque e vendedor existente; NÃO exige preço contextual,
  pois gerar um link não é anunciar preço. Assim o gerador
  técnico e o diagnóstico manual não sofrem regressão.
- `src/robo/mercadolivre-whatsapp.ts`: antes de criar a prévia,
  pacote e mensagem de WhatsApp; grava data de contexto confirmado.
- `src/robo/whatsapp-preparar.ts`: antes de abrir o navegador do
  WhatsApp e novamente imediatamente antes do clique de envio.
  Em modo de teste sem envio, regras anteriores continuam válidas.
- `src/fontes/mercadolivre/preco-contextual.ts`: auditoria
  read-only e guarda composta de estoque + preço.
- `src/robo/mercadolivre-preco-diagnostico.ts`: diagnóstico
  manual com uma consulta de catálogo mais uma de preço, somente
  quando Central 3030 está pausada. Resposta sanitizada, sem
  seller_id, token ou URLs de rastreamento.

## Testes e riscos

Cobertura local obrigatória:
- diferença de 1 centavo;
- HTTP 401/403/429/500 sem retry e sem atribuir sucesso;
- moeda diferente, centavos inválidos, referência antiga;
- comprador/canal não presumidos como Pix ou cartão;
- seller/buybox/estoque divergente interrompem antes do preço;
- geração técnica de links continua independente do endpoint sale_price;
- momento imediatamente anterior ao clique tem a mesma trava;
- nada salva token ou URL de afiliado nos relatórios;
- CI completo e backup/rollback antes de implantar.

A API de sale_price pode não permitir consultar alguns anúncios
de terceiros. Isso não é autorização para contornar 403, imitar
navegadores ou inferir preço; a oferta deve ficar pendente de
revisão. Pode haver false negatives (ofertas reais bloqueadas),
um custo aceito temporariamente para evitar divulgar preço errado.

Não habilitar autoenvio/monitores, nem mesclar o PR em rascunho
sem homologar a condição de pagamento em exemplos reais e a
atribuição comercial pelos relatórios oficiais.
