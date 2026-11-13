# MELI-403 — diagnostico seguro (10/11/2026)

## Estado observado
- Acer online; producao em C:\projeto02 intacta.
- Central 3030 e Captacao 3040 sem listener (nenhum monitor/WhatsApp reiniciado).
- Flags de producao ALTERNATING_MONITOR_ENABLED, MERCADOLIVRE_MONITOR_ENABLED e WHATSAPP_AUTO_SEND_ENABLED estavam true; arquivos de oferta anteriores existem. Nao iniciar a Central de forma nao supervisionada.
- Em 10/11, MERCADOLIVRE_TOKEN_EXPIRES_AT foi classificado como expirado por comparacao com horario UTC (sem ler/exibir tokens). Nenhuma renovacao nem consulta autenticada foi executada.
- Ultima prova real conhecida de HTTP 403: 09/11/2026 GET /items/MLB4709979065, resposta access_denied / FORBIDDEN, request-id 97a947cf-86b2-46a8-a70b-bf19d74881df. Essa resposta nao determina qual politica causou a negacao.

## Causa confirmada no nosso software
- O metodo requisicao() em src/fontes/mercadolivre/api.ts descartava response.body em 403 e lancava excecao generica; por isso a verificacao posterior em getJson() de PA_UNAUTHORIZED_RESULT_FROM_POLICIES era inalcancavel.
- Este defeito era de observabilidade, NAO explica por que a API remota negava acesso; o motivo exato do Mercado Livre continua indeterminado.

## Correcao minima
- Em 403, ler uma unica vez a resposta e extrair apenas error/code reconhecidos e X-Request-ID seguro. Nao persistir corpo bruto, Authorization, token, cookies nem identificadores pessoais.
- Interromper a rodada com o mesmo codigo MERCADOLIVRE_PERMISSION_REQUIRED e sem retry.
- Remover caminho morto que tentava interpretar HTTP 403 apos o bloqueio.
- Preservar 429 e Retry-After, 401 e contratos preexistentes; nenhuma ativacao de monitor, envio, ou consulta externa.
- Testes com fetch simulado sem credenciais reais, inclusive teste de texto malicioso no body, requisicao unica e backoff 429.

## Novas perguntas oficiais (nao respondidas)
1. A aplicacao com APP_ID 8155890644086951 pode consultar GET /items/{id} de anuncios de terceiros para curadoria de afiliados?
2. Qual permissao funcional / politica de acesso se aplica a esse caso especifico?
3. A aplicacao esta ativa, com scopes corretos, sem urn:mp:... e sem restricoes por titularidade ou IP?
4. Existe uma API/feed oficialmente autorizado para descoberta de ofertas de afiliados, com limites de requisicao?
5. O programa permite armazenamento de serie temporal de precos por anuncio, e com qual prazo de retencao?
6. Como abrir ticket formal para esta aplicacao, e o status de elegibilidade DPP?

Fontes publicas:
- https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao/erro-403
- https://developers.mercadolivre.com.br/devcenter/gerencie-seu-aplicativo (exige separar Mercado Livre e Mercado Pago, desde 30/08/2026)
- https://developers.mercadolivre.com.br/pt_br/produto-autenticacao-autorizacao/permissoes-funcionais
- https://developers.mercadolivre.com.br/pt_br/envio-de-produto/suporte-para-integradores

## Criterios futuros
- Para homologar, primeiro garantir ambiente sem envio pendente e sem flags autoativas na inicializacao; tokens rotativos so renovar por rotina existente e quando necessario.
- Reproduzir no maximo uma chamada GET ao anuncio problemático por tentativa de homologacao, respeitando limites, obtendo erro e request-id sanitizados. Nao insistir em 403.
- Comparar com GET /users/me e GET /applications/{APP_ID} apenas quando o acesso funcional estiver autorizado.
- Nunca afirmar que GET de um seller alheio e permitido por existencia de grant OAuth; nem usar scraping/sessoes Chrome para contornar o bloqueio.
- Essa branch nao altera producao nem prova API liberada.
