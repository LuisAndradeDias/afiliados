# Afiliados

Central local para localizar ofertas, validar links de afiliado, preparar conteúdo e revisar o envio no WhatsApp.

## Estado atual

O projeto possui dois fluxos ativos:

- **Amazon**: coleta via navegador, rotação de categorias, score por promoção/comissão, aplicação do Tracking ID e preparação no WhatsApp.
- **Mercado Livre**: coleta via API oficial, filtro de publicação nova + vendedor verde, geração automática do link pelo Gerador de Links oficial através de uma extensão local do Chrome, validação do link e preparação automática no WhatsApp. Depois da revisão, **Enviar + próxima ML** inicia outra oferta automaticamente. O modo manual continua disponível como fallback.

O envio continua dependendo de confirmação humana no painel.

## Stack

- Node.js + TypeScript
- Playwright com Google Chrome
- API oficial do Mercado Livre
- Persistência local em arquivos JSON/TXT
- Painel local em `http://localhost:3030`

## Estrutura

- `src/afiliados/`: regras de links de afiliado.
- `src/fontes/`: coletores Amazon e Mercado Livre.
- `src/ofertas/`: score, comissão, rotação e histórico.
- `src/mensagens/`: formatação das mensagens.
- `src/publicadores/`: pacote e arquivo de publicação.
- `src/robo/`: fluxos executáveis.
- `src/painel/`: servidor e interface local.
- `data/`: estado da máquina, sessões e histórico; não vai para o GitHub.
- `docs/PROJECT_MAP.md`: mapa detalhado da arquitetura e dos fluxos.

## Instalação

```bash
npm ci
npm run typecheck
npm run painel
```

Depois abra:

```text
http://localhost:3030
```

No Windows, também existe `Abrir Painel.bat`.

## Comandos principais

```bash
npm run painel
npm run typecheck

npm run whatsapp:preview
npm run whatsapp:login
npm run whatsapp:preparar

npm run mercadolivre:test
npm run mercadolivre:preview
npm run mercadolivre:whatsapp

npm run automatico
```

## Amazon

Configure `AMAZON_ASSOCIATE_TAG` pelo painel ou no `.env`.

O fluxo normal é:

1. **Nova oferta Amazon**.
2. O sistema busca, pontua e escolhe a melhor oferta disponível.
3. O Tracking ID é aplicado ao link.
4. Foto + mensagem são preparadas no WhatsApp.
5. Você revisa e confirma **Enviar agora** ou **Enviar + próxima Amazon**.

A comissão exibida é uma estimativa baseada na categoria de busca.

## Mercado Livre

O fluxo normal é:

1. Autorize a API Mercado Livre no painel.
2. Clique em **Buscar oferta ML**.
3. Instale uma vez a extensão local em `browser-extension/mercadolivre-affiliate` usando `chrome://extensions/` → **Modo do desenvolvedor** → **Carregar sem compactação**.
4. Quando o painel mostrar **Automação Meli conectada**, clique em **Gerar link automaticamente**.
5. O painel abre Afiliados no mesmo navegador. A extensão localiza o Gerador de Links oficial, cola a URL do produto, clica em gerar e devolve o `meli.la`/`/sec/` ao painel.
6. O backend valida o link oficial e o salva na oferta atual.
7. No modo automático, o painel já monta a mensagem e abre o WhatsApp assim que o link oficial é salvo.
8. Revise foto + legenda.
9. Use **Enviar agora** para encerrar a rodada ou **Enviar + próxima ML** para enviar e iniciar automaticamente a próxima busca → link → preparação.

Se a extensão não estiver ativa ou o Mercado Livre alterar o layout, o modo manual continua disponível: buscar oferta → gerar/colar o link → preparar WhatsApp.

O projeto não fabrica parâmetros de afiliado do Mercado Livre e não trata uma URL normal de produto como link com comissão.

## Reputação e elegibilidade Mercado Livre

A coleta atual:

- usa `/products/search` com paginação;
- consulta publicações do produto;
- mantém somente itens novos;
- consulta vendedores em lote;
- considera verde somente `4_light_green` ou `5_green`;
- aplica desconto mínimo e cooldown;
- limita a cadência de chamadas para reduzir `429`.

## WhatsApp

A sessão persistente fica em:

```text
data/whatsapp-profile/
```

O pacote atual fica em:

```text
data/ultima-oferta-whatsapp.json
data/ultima-mensagem-whatsapp.txt
```

Ao confirmar o envio no painel, a oferta é registrada no histórico.

## Histórico e repetição

O histórico fica em:

```text
data/historico-ofertas.json
```

As chaves são separadas por plataforma, por exemplo:

```text
amazon:B0...
mercado-livre:MLB...
```

Os tempos padrão são controlados por:

```env
OFFER_PREVIEW_COOLDOWN_MINUTES=120
OFFER_COOLDOWN_HOURS=24
```

## Configuração local

Credenciais e sessões nunca devem ser commitadas.

Use `.env.example` como referência e mantenha localmente:

- Amazon Tracking ID
- grupo do WhatsApp
- credenciais OAuth Mercado Livre
- tokens Mercado Livre
- sessões do WhatsApp/Chrome

Consulte `docs/PROJECT_MAP.md` para o mapa completo do projeto.

## Extensão local para links Mercado Livre

Instalação rápida no Windows:

```text
Instalar Automacao Meli.bat
```

Ou manualmente:

1. Abra `chrome://extensions/`.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione `C:\projeto01\browser-extension\mercadolivre-affiliate`.

A extensão não lê cookies, senhas nem tokens. Ela automatiza somente a interface visível do Gerador de Links e conversa com o painel local em `127.0.0.1:3030`.

## Fluxo automático Mercado Livre

Com API, extensão e WhatsApp conectados, o botão **Fluxo automático ML** executa:

```text
buscar oferta elegível
→ gerar link oficial no Gerador de Links
→ validar/salvar meli.la
→ gerar mensagem + pacote
→ abrir grupo no WhatsApp
→ aguardar revisão
```

Depois da revisão:

- **Enviar agora**: envia e encerra a rodada.
- **Enviar + próxima ML**: envia e repete automaticamente o ciclo para outra oferta.

O envio continua exigindo confirmação humana.


## Monitoramento contínuo do Mercado Livre

Quando ativado no painel, o Mercado Livre passa a operar como um ciclo persistente:

```text
monitorar categorias
→ nenhuma oferta válida: aguardar e tentar outra categoria
→ limite 429: aplicar backoff maior e continuar
→ oferta válida: pausar novas buscas
→ gerar link oficial automaticamente
→ preparar imagem + mensagem
→ abrir WhatsApp no grupo
→ aguardar confirmação humana
→ envio confirmado
→ limpar a rodada
→ retomar monitoramento
```

Configuração padrão:

```env
MERCADOLIVRE_MONITOR_ENABLED=false
MERCADOLIVRE_MONITOR_INTERVAL_MINUTES=3
MERCADOLIVRE_MONITOR_BACKOFF_MINUTES=8
```

O monitoramento nunca prepara duas ofertas ao mesmo tempo. Enquanto o WhatsApp está aberto para revisão, novas buscas ficam pausadas.

Quando o monitoramento está ativo, o botão principal de envio vira **Enviar e continuar monitorando**.


## Motor de cupons Mercado Livre

O monitoramento do Mercado Livre também considera cupons oficiais de afiliados.

Fontes usadas:

1. Página pública oficial de promoções: `https://www.mercadolivre.com.br/l/promocoes`.
2. Cupons visíveis no navegador autenticado do usuário, observados pela extensão local enquanto ele navega em páginas do Mercado Livre/Afiliados.

O projeto **não cria nem modifica cupons de vendedores** e não usa endpoints privados descobertos por engenharia reversa. A API `seller-promotions` é destinada à gestão das promoções do próprio vendedor e não é usada para alterar anúncios de terceiros.

### Como a seleção funciona

- o catálogo público é atualizado a cada 2 minutos por padrão;
- cupons observados no navegador autenticado expiram do cache após 10 minutos por padrão;
- o motor valida data, compra mínima, percentual/valor fixo e desconto máximo;
- categorias com exclusões públicas conhecidas são descartadas de forma conservadora;
- cupons não cumulativos são tratados como benefício alternativo, nunca somados ao desconto do anúncio;
- a oferta pode atingir o filtro mínimo usando o melhor benefício efetivo entre promoção e cupom;
- imediatamente antes de abrir o WhatsApp, o cupom é consultado novamente;
- se o cupom sumir/expirar e a oferta deixar de atingir o filtro mínimo, a rodada é descartada e o monitor continua procurando outra.

Configuração:

```env
MERCADOLIVRE_COUPON_REFRESH_MINUTES=2
MERCADOLIVRE_COUPON_OBSERVED_TTL_MINUTES=10
MERCADOLIVRE_COUPON_SOURCE_URL=https://www.mercadolivre.com.br/l/promocoes
```

Quando um cupom é usado, a mensagem informa que o preço é estimado e está sujeito à elegibilidade e disponibilidade no checkout.


## Monitoramento intercalado Amazon + Mercado Livre

O modo operacional principal usa um único relógio para evitar consultas simultâneas:

```text
00:00  Mercado Livre
01:00  Amazon
02:00  Mercado Livre
03:00  Amazon
04:00  Mercado Livre
...
```

Assim, cada plataforma é consultada aproximadamente a cada **2 minutos**, com **1 minuto de distância** entre as plataformas.

Configuração:

```env
ALTERNATING_MONITOR_ENABLED=true
ALTERNATING_MONITOR_SLOT_SECONDS=60
```

Regras operacionais:

- nunca executa Amazon e Mercado Livre ao mesmo tempo;
- se uma busca ainda estiver ocupada, o próximo turno aguarda;
- quando uma oferta é encontrada, todo o relógio pausa enquanto o WhatsApp aguarda revisão;
- depois de **Enviar** ou **Descartar**, o ciclo retoma pela outra plataforma;
- se o Mercado Livre entrar em backoff por limite de API, apenas os turnos do Meli são pulados; a Amazon continua sendo consultada;
- cada plataforma continua usando sua própria rotação de categorias e seu próprio histórico/cooldown.

O processo legado `npm run automatico` da Amazon continua disponível apenas para diagnóstico, mas não deve ser executado junto com o monitoramento intercalado do painel.
