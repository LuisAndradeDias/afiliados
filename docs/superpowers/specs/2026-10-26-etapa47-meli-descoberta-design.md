# Afiliados 2.0 — Etapa 4.7: descoberta segura Mercado Livre

Data: 2026-10-26
Base: PR #44 `chore/instalacao-segura-windows-etapa46`.
Escopo: somente codigo de busca Mercado Livre, testes simulados, CI e documentacao. Instalacao ACER `C:\\afiliados-v2-homologacao` continua ativa e nao e alvo de alteracoes.

## Evidencia e objetivo

Na validacao real supervisionada do ACER, OAuth respondeu HTTP 200 e `products/search` listou milhares de produtos, porem `/products/{id}/items` devolveu HTTP 404 para grande parte (7/10 em uma amostra). A sondagem recebeu HTTP 429 por excesso de chamadas. `/users/bulk` funcionou (15/20 vendedores com reputacao verde). Uma amostra de air fryer gerou 2 anuncios, 1 com desconto >=20%, mas o filtro instalado exige 25% e consulta uma categoria minima por rodada.

O codigo atual pula 404 corretamente, **mas consulta novamente o mesmo produto nas rodadas seguintes**, guarda ritmo por instancia (novas categorias reiniciam o intervalo) e tenta ate 4 vezes apos cada 429, podendo aumentar a limitacao da API. Alguns erros 429 por publicacao/reputacao sao engolidos e a busca segue consultando.

**Objetivo:** reduzir consultas improdutivas sem aumentar agressividade de busca, respeitar explicitamente 429, preservar vendedor verde/desconto real/antiduplicacao e mostrar diagnosticos agregados.

## Abordagens comparadas

1. Expandir categorias, paginas ou baixar desconto de 25% — rejeitado; aumentaria chamadas, causaria 429 e reduziria qualidade.
2. Procurar endpoints alternativos privados/nao documentados — rejeitado; inseguro e instavel.
3. **Escolhida:** cache temporario e limitado apenas de HTTP 404 comprovado em catalogo, ritmo compartilhado por processo, fail-fast de HTTP 429 com backoff ja existente no painel e regressao de elegibilidade. A busca continua somente nas categorias e limites existentes.

## Comportamento esperado

- Cache negativo arquivo `data/mercadolivre-catalogo-404.json`, TTL de 30 min, maximo 500 IDs publicos, sem guardar tokens, usuarios, vendedores ou contatos. Somente marcar HTTP 404 real de `/products/{id}/items`. Um HTTP 200 com zero resultados, 429, 401, 403 ou falha de rede NUNCA entram no cache.
- Nas rodadas futuras, IDs ainda marcados sao pulados; vencidos voltam a ser consultados. Arquivo ausente/corrompido, falha de gravação, diretorio nao gravavel ou registro invalido nao travam a busca. Escrita temporaria + rename atomico e nao sobrescrever dados privados.
- Ritmo de chamadas `api.mercadolibre.com` compartilhado entre instancias da fonte no mesmo processo; respeitar `MERCADOLIVRE_REQUEST_INTERVAL_MS` existente com piso historico 250ms. Nao iniciar duas chamadas simultaneas no mesmo processo. O ritmo de uma nova categoria nao comeca do zero.
- Recebeu HTTP 429: parar imediatamente, sem outras chamadas/retries na mesma rodada. Erro especifico com mensagem `HTTP 429` e `limite de requisicoes`, para o painel acionar o backoff de 8 minutos ja implementado. Falhas de reputacao no limite tambem interrompem a rodada em vez de marcar falsamente vendedores como nao verdes.
- O preview registra status de limite e encerra com codigo 5, sem publicar ou abrir WhatsApp; o fluxo do painel trata codigo nao zero e preserva backoff.
- Diagnostico em log somente agregados: catalogos consultados, 404 conhecidos/novos, ofertas de vendedores verdes, descontos que passaram no minimo atual. Nenhum token, ID de usuario, telefone ou historico pessoal.
- Manter `MIN_DISCOUNT_PERCENT=25` e `MERCADOLIVRE_QUERIES_PER_RUN=1` no ACER; nenhuma mudanca de configuracao antiga ou nova.
- Nao consumir OAuth real para testar: usar token explicito falso e `global.fetch` mockado com dados ficticios.
- Nenhuma chamada real a WhatsApp ou Mercado Livre; nenhum deploy/merge. PR draft #45 sobre #44. Sem PostgreSQL e sem Drive.

## Riscos e mitigacoes

- Um 404 pode ser temporario: TTL 30 minutos + limite 500 e revalidacao apos expirar; arquivo nao e fonte de qualidade/preco.
- Limite pode ocorrer na ultima consulta: devolver erro, nao oferta parcial inadequada nem nova tentativa imediata.
- Em caso de erro de cache: registrar aviso generico, continuar sem cache; a busca funciona sem arquivo.
- Em caso de corrupcao: descartar cache, nao apagar nenhum arquivo do usuario.
- A CI valida no Windows e Linux: 404 repetido/elegivel, expiracao, HTTP 429 em catalogo e reputacao, pacing entre instancias, qualidade de 25%, TypeScript, captação e central.
- PRs #38–#44 continuam empilhados e nao mesclados. Homologacao ACER real so apos revisao independente.
