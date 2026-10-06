# Mapa do projeto

Este documento descreve o estado atual do projeto e deve ser atualizado quando um fluxo importante mudar.

## Objetivo

Localizar ofertas elegíveis, aplicar regras de afiliados, preparar conteúdo para WhatsApp e manter a confirmação humana antes do envio.

## Fluxos principais

### Amazon

1. `src/fontes/amazon/browser.ts` coleta resultados públicos via Chrome.
2. `src/robo/pipeline.ts` faz rotação de consultas, score, comissão estimada e cooldown.
3. `src/afiliados/amazon.ts` aplica o Tracking ID quando configurado.
4. `src/robo/whatsapp-preview.ts` gera mensagem e pacote.
5. `src/robo/whatsapp-preparar.ts` abre o WhatsApp, anexa imagem e aguarda confirmação.
6. `src/ofertas/historico.ts` registra visualização e envio.

### Mercado Livre

1. `src/fontes/mercadolivre/api.ts` consulta o catálogo e publicações pela API oficial.
2. A fonte exige publicação nova e vendedor com reputação verde.
3. `src/robo/mercadolivre-preview.ts` aplica desconto mínimo, cooldown e escolhe a melhor oferta.
4. O painel cria um job de link e abre o Portal de Afiliados no navegador do usuário.
5. `browser-extension/mercadolivre-affiliate/` usa a sessão web já autenticada, localiza o Gerador de Links oficial, preenche a URL do produto, gera e devolve o link ao painel.
6. O painel mantém o estado do job em memória e recebe o resultado pelos endpoints `/api/mercadolivre/link-*`.
7. `src/afiliados/mercadolivre.ts` valida e salva somente links oficiais de compartilhamento (`meli.la` ou `/sec/`).
8. Quando o fluxo automático está ativo, o backend encadeia o resultado do link diretamente em `src/robo/mercadolivre-whatsapp.ts`.
9. `src/robo/mercadolivre-whatsapp.ts` transforma a oferta validada em mensagem/pacote.
10. `src/robo/whatsapp-preparar.ts` abre o grupo e aguarda confirmação humana.
11. **Enviar + próxima ML** registra o envio e reinicia busca → link → preparação.
12. O histórico usa a chave `mercado-livre:<produtoId>`, evitando repetição.

## Pastas

- `src/afiliados/`: regras de transformação/validação de links de afiliado.
- `src/fontes/`: conectores de coleta. Não devem enviar mensagens.
- `src/ofertas/`: score, comissão, rotação e histórico/cooldown.
- `src/mensagens/`: formatação de mensagens por plataforma.
- `src/publicadores/`: persistência do pacote/mensagem a publicar.
- `src/robo/`: orquestração dos fluxos executáveis.
- `src/painel/`: servidor local e interface de operação.
- `data/`: estado local, sessões, ofertas e histórico. Não deve ser versionado.
- `docs/`: documentação operacional e mapa de arquitetura.
- `browser-extension/mercadolivre-affiliate/`: automação local do Gerador de Links oficial do Mercado Livre.

## Arquivos locais importantes

- `.env`: credenciais e configuração da máquina.
- `data/ultima-oferta-mercadolivre.json`: melhor oferta ML e link oficial quando salvo.
- `data/ultima-oferta-whatsapp.json`: pacote atualmente preparado.
- `data/ultima-mensagem-whatsapp.txt`: mensagem atualmente preparada.
- `data/historico-ofertas.json`: cooldown e registros de envio.
- `data/whatsapp-profile/`: sessão persistente do WhatsApp Web.

## Regras de segurança do fluxo

- Nunca fabricar parâmetros de afiliado do Mercado Livre.
- A automação do link deve operar na interface oficial do Gerador de Links; não usar endpoints privados/descobertos por engenharia reversa.
- Não tratar URL normal de produto como link de afiliado.
- Mercado Livre só pode ser preparado para WhatsApp depois de salvar um link oficial.
- O envio continua dependente de confirmação no painel.
- Tokens, cookies, perfis de navegador e `.env` ficam somente na máquina local.

## Comandos

- `npm run painel`: painel local.
- `npm run whatsapp:preview`: busca Amazon e gera pacote.
- `npm run whatsapp:preparar`: abre o pacote atual no WhatsApp.
- `npm run mercadolivre:preview`: busca melhor oferta ML.
- `npm run mercadolivre:whatsapp`: gera pacote WhatsApp a partir da oferta ML com link oficial.
- `npm run typecheck`: valida o projeto.


## Monitoramento contínuo Mercado Livre

O estado do monitor vive no servidor do painel.

- `MERCADOLIVRE_MONITOR_ENABLED`: restaura o monitor após reiniciar o painel.
- `MERCADOLIVRE_MONITOR_INTERVAL_MINUTES`: intervalo normal entre rodadas sem oferta.
- `MERCADOLIVRE_MONITOR_BACKOFF_MINUTES`: espera maior após limitação da API.
- uma rodada consulta a próxima categoria da rotação em `data/rotacao-mercadolivre.json`.
- ao encontrar oferta, o agendamento é suspenso enquanto link/WhatsApp são preparados.
- após envio confirmado ou descarte, o monitor agenda a próxima rodada.
- o Gerador de Links continua sendo executado pela extensão local do Chrome.
- a extensão pode reabrir uma aba de Afiliados em segundo plano quando existir um job pendente.


## Motor de cupons Mercado Livre

Arquivos principais:

- `src/afiliados/mercadolivre-cupons.ts`: coleta, cache, parsing, ranking, cálculo de benefício e revalidação.
- `src/robo/mercadolivre-preview.ts`: aplica o melhor cupom às ofertas antes do filtro mínimo.
- `src/robo/mercadolivre-whatsapp.ts`: força uma nova validação do cupom imediatamente antes da mensagem.
- `browser-extension/mercadolivre-affiliate/content.js`: observa somente blocos visíveis de cupom no navegador.
- `POST /api/mercadolivre/coupons-observed`: recebe os blocos observados e grava cache curto.

Regras:

- Cupons públicos/observados são tratados como dados voláteis.
- Cupons observados no navegador têm TTL curto.
- Cupons marcados como não cumulativos não são somados ao preço promocional.
- O preço com cupom exibido ao usuário é uma estimativa condicionada à elegibilidade no checkout.
- A API de campanhas do vendedor não é usada para anúncios de terceiros.


## Agendador intercalado Amazon + Mercado Livre

O coordenador do painel em `src/painel/server.ts` controla as duas plataformas com um slot padrão de 60 segundos.

Sequência normal:

1. Mercado Livre.
2. +60s Amazon.
3. +60s Mercado Livre.
4. +60s Amazon.

Consequentemente, cada fonte tem cadência aproximada de 120 segundos.

O agendador mantém apenas um timer pendente e pausa quando houver busca, geração de link, preparação ou revisão no WhatsApp. Ao concluir ou descartar uma oferta, a próxima plataforma é sempre a outra.

Variáveis:

- `ALTERNATING_MONITOR_ENABLED`
- `ALTERNATING_MONITOR_SLOT_SECONDS`
- `MERCADOLIVRE_MONITOR_BACKOFF_MINUTES`

`MERCADOLIVRE_MONITOR_ENABLED` é mantida por compatibilidade e também é atualizada quando o ciclo unificado é ligado/desligado.


## Estado operacional do painel

O servidor é a fonte única de verdade do painel e expõe:

- `operacaoEstado`
- `operacaoPlataforma`
- `ofertaPlataformaAtual`
- `ofertaPreparada`
- `whatsappRevisaoPronta`

A UI não deve inferir a origem da oferta combinando `origemPreparacaoAtual` com o último turno do monitor. Quando houver pacote preparado, `ofertaPlataformaAtual` é a referência canônica.

A ação principal do ciclo é `monitor-set`, com `ativo: true|false`. `mercadolivre-monitor-toggle` fica apenas para compatibilidade.

Ao falhar/fechar a janela de revisão, o pacote é preservado e o estado vira `offer-pending`. O usuário deve reabrir ou descartar antes que o agendador volte a pesquisar.
