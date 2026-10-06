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
