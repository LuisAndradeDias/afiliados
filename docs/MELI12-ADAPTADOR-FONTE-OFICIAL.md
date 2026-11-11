# MELI-12 — Pré-homologação do adaptador oficial de preços

Data: 11/11/2026. Branch: feat/meli12-adaptador-precos-20261111.

## Objetivo operacional

Preparar a primeira integração de preços da API oficial do Mercado Livre com o Histórico Inteligente do Caça Promos VIP. Não ampliar o privilégio do OAuth por suposição, não contornar 403, não fazer scraping e não anunciar descontos baseados em valores sem confirmação.

O usuário autorizou o desenvolvimento e a implantação *segura*. Essa autorização não substitui a autorização da plataforma para consultar anúncios de terceiros e armazenar preços.

## Base documental revisada

- https://developers.mercadolivre.com.br/devcenter/api-de-precos — GET /items/{itemId}/sale_price?context=channel_marketplace; fields amount, regular_amount, currency_id, reference_date. A API /items/{id}/prices fornece estrutura de preços e restrições; nenhum dos documentos confirma acesso automático de afiliado a itens de terceiros.
- https://developers.mercadolivre.com.br/pt_br/guia-para-produtos/erro-403 — HTTP 403 pode estar associado a permissões, bloqueio de aplicação, token de titular diferente, escopo ou IP.
- https://developers.mercadolivre.com.br/controle-de-acesso-e-autorizacao — negue por padrão e valide permissões no servidor.
- https://www.mercadolivre.com.br/l/primeiros-passos-perguntas-frequentes-para-afiliados — não publicar dados falsos, incompletos ou desatualizados.

## Entrega MELI-12

- src/historico/mercadolivre-sale-price.ts: adaptador estrito para a resposta JSON de /sale_price no contexto marketplace.
- Não contém implementação de HTTP, fetch automático, credencial, OAuth, refresh, agendamento, scraping ou automação WhatsApp.
- A função `consultarSalePriceAutorizado` exige *todos* os parâmetros: evidência de autorização oficial de consulta a terceiros, revisão humana do escopo específico, metadados de produto de cadastro autorizado e recente, provedor de token, transporte explicitamente injetado e sinal de cancelamento.
- O objeto de aprovação representa uma declaração que precisará ser verificada por um responsável. Preencher o objeto por conta própria **não prova que o Mercado Livre liberou o acesso**.
- Sem aprovação ou cadastro confiável, a função falha antes de consultar o token ou chamar o transporte.
- Constrói exclusivamente URL HTTPS fixa para MLB e parâmetro channel_marketplace. O transporte futuro deve recusar redirecionamentos e obedecer a timeout.
- Valida moeda BRL, valor em centavos, idade da referência, tamanho do JSON e formato do cadastro.
- Traduz 401/403 em `MERCADOLIVRE_PERMISSION_REQUIRED`, 429 em `MERCADOLIVRE_RATE_LIMIT`, demais erros externos em códigos sanitizados. Jamais devolve o corpo bruto, token ou metadados privados.
- O preço retornado recebe `modalidadePagamento=nao_informada`, `disponibilidade=indeterminada`, `podeCompararComoDesconto=false`, `podePublicar=false`. **Não chamar preço de canal de Pix ou cartão.**
- O resultado ainda **não é convertido em uma Observacao MELI-11** porque o esquema atual suporta apenas Pix/cartão e não possui prova de estoque. Converter diretamente criaria um dado semanticamente falso.

## Evidências exigidas

- `npm run test:meli12`: 22 cenários com transporte em memória, zero requisições externas, cobre 403/429, sanitização, fonte falsa, token rejeitado, timestamp e moeda.
- `npm run typecheck`.
- `npm run test:meli11` e `npm run test:meli11-ui` (não regressão da etapa anterior).
- GitHub Actions completo antes do merge.
- Nenhuma alteração da UI, backend server.ts, credenciais ou bancos de produção.

## Bloqueios e próximos passos

1. Receber resposta explícita do suporte do Mercado Livre para APP_ID e aplicação de afiliados: se /sale_price ou /prices pode ser usado para **anúncios de terceiros**, quais contextos, taxas, campos e retenção.
2. Arquivar o protocolo oficial e a revisão de escopo sem tokens; confirmar data de validade/revogação.
3. Escolher uma fonte oficial autorizada de cadastro (item, vendedor, variante) e outra de estoque verificável; não inferir disponibilidade de /sale_price.
4. Evoluir o schema MELI-11 com modalidade `preco_geral_marketplace`, migração reversível e isolamento de Pix/cartão, além de status visual apropriado.
5. Criar transporte HTTPS allowlist apenas após aprovação, com redirecionamento proibido, timeouts, backoff, quotas, trilha de evidência sanitizada, retentativas limitadas e cancelamento imediato após 403.
6. Testar lote pequeno de forma autorizada no ambiente isolado, com banco temporário e sem publicação. Revisar política de retenção/revogação, backups e segurança antes de ativar o motor.
7. No momento, a Central em C:\\projeto02 permanece com o MELI-11 implantado e **coleta real desligada**.

## Segurança

Nunca usar acesso por navegador, scraping, IP alternativo, extensão ou extração de páginas para driblar 403. Não editar arquivos .env de produção nem compartilhar segredos. Não iniciar ou desbloquear monitor alternado, WhatsApp ou fila sem etapa independente e evidência operacional.
