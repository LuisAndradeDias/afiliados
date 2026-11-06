# MELI-07 — resultados da investigação e limite de acesso

## Verificações reais em 06/11/2026 (Acer)
O token estava vencido e foi renovado pelo mecanismo existente com trava de concorrência. Não houve troca de conta, identidade, Client ID ou Secret. A renovação normal atualizou access/refresh token no .env; não declarar que o arquivo ficou inteiramente intocado.

| Verificação | Resultado observado |
|---|---|
| /users/me | HTTP 200, conta ativa |
| /applications/{app_id} | HTTP 200, aplicativo ativo, sandbox_mode=false |
| Autorização correspondente em /users/{user_id}/applications | Encontrada; read, offline_access e escopos de leitura de publicação/sincronização e ofertas |
| Separação Mercado Livre / Mercado Pago | Nenhum escopo urn:mp nos escopos retornados |
| Certificação | not_certified; não foi demonstrado que isso explique o bloqueio |
| /items/{item_id} | HTTP 403 access_denied |
| /items/bulk?ids={item_id} | Envelope HTTP 200, elemento status_code=403, sem body |
| /items/{item_id}/sale_price | HTTP 403 |
| /products/search (sondagem posterior limitada) | HTTP 429; interrompida na primeira resposta |
| Página pública /ofertas em Chrome isolado | HTTP 403; não utilizada como fonte validada |

Esses dados descartam token expirado como explicação suficiente após sua renovação. A autorização genérica existe, mas não comprova acesso aos anúncios de terceiros. Não há base para prometer que alterar scopes, ampliar páginas, contratar proxy ou trocar o endpoint resolveria o problema.

## Melhorias implementadas e comportamento esperado
1. Até três anúncios de vendedores aprovados por produto são revalidados. Um anúncio esgotado/pausado/404 não elimina automaticamente outro candidato válido. A classificação considera os preços confirmados, não apenas o desconto do catálogo.
2. HTTP 403 e HTTP 429 interrompem a rodada e são distinguíveis no preview/painel. Uma resposta HTTP 200 em lote não mascara erro individual. Nenhum permalink é inventado.
3. HTTP 429 não gera quatro tentativas imediatas. O painel respeita o maior prazo entre o backoff existente e Retry-After (segundos ou data HTTP). Novas buscas manuais Meli também respeitam o bloqueio.
4. Consultas têm timeout de 15 segundos. Intervalos de requisição válidos maiores permanecem respeitados.
5. Amazon continua independente do bloqueio Meli. Modos média/longa, 20%/24h/120min, catálogo autorizado, OAuth e validações do WhatsApp não são enfraquecidos.

## Fontes oficiais
- https://developers.mercadolivre.com.br/pt_br/itens-e-buscas (31/08/2026): migração bulk e status_code por elemento.
- https://developers.mercadolivre.com.br/pt_br/guia-para-produtos/erro-403: permissões, titularidade e outros motivos possíveis; 403 não significa estoque esgotado.
- https://developers.mercadolivre.com.br/pt_br/produto-consulta-de-usuarios/gerencie-seu-aplicativo (15/10/2026): aplicativo, scopes, grants e separação entre unidades.
- https://developers.mercadolivre.com.br/pt_br/permissoes-funcionais/: publicação/sincronização e ofertas são permissões funcionais; não autorizam automaticamente qualquer dado de terceiros.
- https://developers.mercadolivre.com.br/autenticacao-e-autorizacao: limites de requisição e OAuth.
- https://www.mercadolivre.com.br/l/escolha-produtos-para-recomendar: Central de Afiliados e Ofertas do dia como fontes comerciais adequadas.

## Próximo caminho comercial fundamentado
A Central de Afiliados e Ofertas do dia são recomendadas oficialmente para descoberta. Uma integração assistida com a página autenticada só deve ser ativada depois de validar visualmente preço, identificação do anúncio, indisponibilidade e elegibilidade no portal. Não foi implementada extração autenticada sem essa evidência.

Mensagem preparada para o suporte oficial, sem segredos:
> Nossa aplicação de afiliados está ativa e possui grant de leitura correspondente. /users/me responde 200. Os escopos retornados incluem leitura de publicação/sincronização e ofertas, sem escopos Mercado Pago. Ao consultar anúncio de terceiro, /items/{id} responde 403 access_denied; /items/bulk responde 200 no envelope mas status_code=403 no elemento; /sale_price também responde 403. Qual recurso oficial e qual autorização são permitidos para descobrir e validar ofertas de terceiros para afiliados? Existe interface autorizada para os produtos recomendados da Central de Afiliados? Solicitamos confirmação do caminho permitido, não contorno da restrição.

## Limitações explícitas
- Os ganhos de recuperação/ranking foram demonstrados em testes sintéticos, não em uma venda ou oferta real aprovada.
- A proteção de espera desta versão pertence ao processo do painel e segue o backoff já existente; reiniciar o painel perde esse estado transitório. Não foi criada persistência de filas nem novo serviço.
- A revisão de código desta etapa é auto-revisão do implementador, sem revisor independente. CI e testes são evidências complementares, não prova de ausência absoluta de defeitos.
- Campos legados do funil referentes a 403 ficam zero em rodadas concluídas: uma rodada negada agora termina como erro explícito, antes de emitir resumo de sucesso.
