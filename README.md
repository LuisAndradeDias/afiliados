# Afiliados

Central local para localizar ofertas, validar links de afiliado, preparar conte�do e revisar o envio no WhatsApp.

## Estado atual

O projeto possui dois fluxos ativos:

- **Amazon**: coleta via navegador, rota��o de categorias, score por promo��o/comiss�o, aplica��o do Tracking ID e prepara��o no WhatsApp.
- **Mercado Livre**: coleta via API oficial, filtro de publica��o nova + vendedor verde, gera��o autom�tica do link pelo Gerador de Links oficial atrav�s de uma extens�o local do Chrome, valida��o do link e prepara��o autom�tica no WhatsApp. Depois da revis�o, **Enviar + pr�xima ML** inicia outra oferta automaticamente. O modo manual continua dispon�vel como fallback.

O envio continua dependendo de confirma��o humana no painel.

## Stack

- Node.js + TypeScript
- Playwright com Google Chrome
- API oficial do Mercado Livre
- Persist�ncia local em arquivos JSON/TXT
- Painel local em `http://localhost:3030`

## Estrutura

- `src/afiliados/`: regras de links de afiliado.
- `src/fontes/`: coletores Amazon e Mercado Livre.
- `src/ofertas/`: score, comiss�o, rota��o e hist�rico.
- `src/mensagens/`: formata��o das mensagens.
- `src/publicadores/`: pacote e arquivo de publica��o.
- `src/robo/`: fluxos execut�veis.
- `src/painel/`: servidor e interface local.
- `data/`: estado da m�quina, sess�es e hist�rico; n�o vai para o GitHub.
- `docs/PROJECT_MAP.md`: mapa detalhado da arquitetura e dos fluxos.

## Instala��o

```bash
npm ci
npm run typecheck
npm run painel
```

Depois abra:

```text
http://localhost:3030
```

No Windows, tamb�m existe `Abrir Painel.bat`.

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

O fluxo normal �:

1. **Nova oferta Amazon**.
2. O sistema busca, pontua e escolhe a melhor oferta dispon�vel.
3. O Tracking ID � aplicado ao link.
4. Foto + mensagem s�o preparadas no WhatsApp.
5. Voc� revisa e confirma **Enviar agora** ou **Enviar + pr�xima Amazon**.

A comiss�o exibida � uma estimativa baseada na categoria de busca.

## Mercado Livre

O fluxo normal �:

1. Autorize a API Mercado Livre no painel.
2. Clique em **Buscar oferta ML**.
3. Instale uma vez a extens�o local em `browser-extension/mercadolivre-affiliate` usando `chrome://extensions/`  **Modo do desenvolvedor**  **Carregar sem compacta��o**.
4. Quando o painel mostrar **Automa��o Meli conectada**, clique em **Gerar link automaticamente**.
5. O painel abre Afiliados no mesmo navegador. A extens�o localiza o Gerador de Links oficial, cola a URL do produto, clica em gerar e devolve o `meli.la`/`/sec/` ao painel.
6. O backend valida o link oficial e o salva na oferta atual.
7. No modo autom�tico, o painel j� monta a mensagem e abre o WhatsApp assim que o link oficial � salvo.
8. Revise foto + legenda.
9. Use **Enviar agora** para encerrar a rodada ou **Enviar + pr�xima ML** para enviar e iniciar automaticamente a pr�xima busca  link  prepara��o.

Se a extens�o n�o estiver ativa ou o Mercado Livre alterar o layout, o modo manual continua dispon�vel: buscar oferta  gerar/colar o link  preparar WhatsApp.

O projeto n�o fabrica par�metros de afiliado do Mercado Livre e n�o trata uma URL normal de produto como link com comiss�o.

## Reputa��o e elegibilidade Mercado Livre

A coleta atual:

- usa `/products/search` com pagina��o;
- consulta publica��es do produto;
- mant�m somente itens novos;
- consulta vendedores em lote;
- considera verde somente `4_light_green` ou `5_green`;
- aplica desconto m�nimo e cooldown;
- limita a cad�ncia de chamadas para reduzir `429`.

## WhatsApp

A sess�o persistente fica em:

```text
data/whatsapp-profile/
```

O pacote atual fica em:

```text
data/ultima-oferta-whatsapp.json
data/ultima-mensagem-whatsapp.txt
```

Ao confirmar o envio no painel, a oferta � registrada no hist�rico.

## Hist�rico e repeti��o

O hist�rico fica em:

```text
data/historico-ofertas.json
```

As chaves s�o separadas por plataforma, por exemplo:

```text
amazon:B0...
mercado-livre:MLB...
```

Os tempos padr�o s�o controlados por:

```env
OFFER_PREVIEW_COOLDOWN_MINUTES=120
OFFER_COOLDOWN_HOURS=24
```

## Configura��o local

Credenciais e sess�es nunca devem ser commitadas.

Use `.env.example` como refer�ncia e mantenha localmente:

- Amazon Tracking ID
- grupo do WhatsApp
- credenciais OAuth Mercado Livre
- tokens Mercado Livre
- sess�es do WhatsApp/Chrome

Consulte `docs/PROJECT_MAP.md` para o mapa completo do projeto.

## Extens�o local para links Mercado Livre

Instala��o r�pida no Windows:

```text
Instalar Automacao Meli.bat
```

Ou manualmente:

1. Abra `chrome://extensions/`.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compacta��o**.
4. Selecione `C:\projeto01\browser-extension\mercadolivre-affiliate`.

A extens�o n�o l� cookies, senhas nem tokens. Ela automatiza somente a interface vis�vel do Gerador de Links e conversa com o painel local em `127.0.0.1:3030`.

## Fluxo autom�tico Mercado Livre

Com API, extens�o e WhatsApp conectados, o bot�o **Fluxo autom�tico ML** executa:

```text
buscar oferta eleg�vel
 gerar link oficial no Gerador de Links
 validar/salvar meli.la
 gerar mensagem + pacote
 abrir grupo no WhatsApp
 aguardar revis�o
```

Depois da revis�o:

- **Enviar agora**: envia e encerra a rodada.
- **Enviar + pr�xima ML**: envia e repete automaticamente o ciclo para outra oferta.

O envio continua exigindo confirma��o humana.


## Monitoramento cont�nuo do Mercado Livre

Quando ativado no painel, o Mercado Livre passa a operar como um ciclo persistente:

```text
monitorar categorias
 nenhuma oferta v�lida: aguardar e tentar outra categoria
 limite 429: aplicar backoff maior e continuar
 oferta v�lida: pausar novas buscas
 gerar link oficial automaticamente
 preparar imagem + mensagem
 abrir WhatsApp no grupo
 aguardar confirma��o humana
 envio confirmado
 limpar a rodada
 retomar monitoramento
```

Configura��o padr�o:

```env
MERCADOLIVRE_MONITOR_ENABLED=false
MERCADOLIVRE_MONITOR_INTERVAL_MINUTES=3
MERCADOLIVRE_MONITOR_BACKOFF_MINUTES=8
```

O monitoramento nunca prepara duas ofertas ao mesmo tempo. Enquanto o WhatsApp est� aberto para revis�o, novas buscas ficam pausadas.

Quando o monitoramento est� ativo, o bot�o principal de envio vira **Enviar e continuar monitorando**.


## Motor de cupons Mercado Livre

O monitoramento do Mercado Livre tamb�m considera cupons oficiais de afiliados.

Fontes usadas:

1. P�gina p�blica oficial de promo��es: `https://www.mercadolivre.com.br/l/promocoes`.
2. Cupons vis�veis no navegador autenticado do usu�rio, observados pela extens�o local enquanto ele navega em p�ginas do Mercado Livre/Afiliados.

O projeto **n�o cria nem modifica cupons de vendedores** e n�o usa endpoints privados descobertos por engenharia reversa. A API `seller-promotions` � destinada � gest�o das promo��es do pr�prio vendedor e n�o � usada para alterar an�ncios de terceiros.

### Como a sele��o funciona

- o cat�logo p�blico � atualizado a cada 2 minutos por padr�o;
- cupons observados no navegador autenticado expiram do cache ap�s 10 minutos por padr�o;
- o motor valida data, compra m�nima, percentual/valor fixo e desconto m�ximo;
- categorias com exclus�es p�blicas conhecidas s�o descartadas de forma conservadora;
- cupons n�o cumulativos s�o tratados como benef�cio alternativo, nunca somados ao desconto do an�ncio;
- a oferta pode atingir o filtro m�nimo usando o melhor benef�cio efetivo entre promo��o e cupom;
- imediatamente antes de abrir o WhatsApp, o cupom � consultado novamente;
- se o cupom sumir/expirar e a oferta deixar de atingir o filtro m�nimo, a rodada � descartada e o monitor continua procurando outra.

Configura��o:

```env
MERCADOLIVRE_COUPON_REFRESH_MINUTES=2
MERCADOLIVRE_COUPON_OBSERVED_TTL_MINUTES=10
MERCADOLIVRE_COUPON_SOURCE_URL=https://www.mercadolivre.com.br/l/promocoes
```

Quando um cupom � usado, a mensagem informa que o pre�o � estimado e est� sujeito � elegibilidade e disponibilidade no checkout.


## Monitoramento intercalado Amazon + Mercado Livre

O modo operacional principal usa um �nico rel�gio para evitar consultas simult�neas:

```text
00:00  Mercado Livre
01:00  Amazon
02:00  Mercado Livre
03:00  Amazon
04:00  Mercado Livre
...
```

Assim, cada plataforma � consultada aproximadamente a cada **2 minutos**, com **1 minuto de dist�ncia** entre as plataformas.

Configura��o:

```env
ALTERNATING_MONITOR_ENABLED=true
ALTERNATING_MONITOR_SLOT_SECONDS=60
```

Regras operacionais:

- nunca executa Amazon e Mercado Livre ao mesmo tempo;
- se uma busca ainda estiver ocupada, o pr�ximo turno aguarda;
- quando uma oferta � encontrada, todo o rel�gio pausa enquanto o WhatsApp aguarda revis�o;
- depois de **Enviar** ou **Descartar**, o ciclo retoma pela outra plataforma;
- se o Mercado Livre entrar em backoff por limite de API, apenas os turnos do Meli s�o pulados; a Amazon continua sendo consultada;
- cada plataforma continua usando sua pr�pria rota��o de categorias e seu pr�prio hist�rico/cooldown.

O processo legado `npm run automatico` da Amazon continua dispon�vel apenas para diagn�stico, mas n�o deve ser executado junto com o monitoramento intercalado do painel.


## Painel operacional v2

O painel principal representa um �nico ciclo **Amazon + Mercado Livre**.

Estados expostos pelo backend:

- `paused`: novas buscas pausadas.
- `scheduled`: aguardando o pr�ximo slot do ciclo.
- `searching`: uma plataforma est� sendo consultada.
- `linking`: o Mercado Livre est� gerando/validando o link oficial.
- `preparing`: uma oferta foi escolhida e o WhatsApp est� sendo aberto/preparado.
- `review`: o WhatsApp confirmou que a mensagem est� pronta para revis�o.
- `sending`: o envio foi solicitado e aguarda confirma��o real do WhatsApp.
- `offer-pending`: existe uma oferta salva, mas n�o h� janela de revis�o ativa; o usu�rio pode reabrir ou descartar.
- `error`: interven��o necess�ria.

O bot�o principal usa uma a��o idempotente `monitor-set`. A interface envia explicitamente o estado desejado (ativo/pausado), evitando que uma tela desatualizada inverta o ciclo por engano.

A plataforma exibida na revis�o vem do pacote real da oferta (`ultima-oferta-whatsapp.json`), e n�o da �ltima plataforma consultada pelo monitor.

Se o WhatsApp fechar ou falhar depois que a oferta foi criada, a oferta � preservada como `offer-pending`; o ciclo n�o inicia outra busca por cima dela.

## WhatsApp no computador novo: grupo e sessao do painel

A janela normal do Chrome e o perfil persistente do rob� **nao sao a mesma
sessao**. O painel usa `C:\projeto01\data\whatsapp-profile` (nao
commitado); a existencia dessa pasta **nao comprova que o login esta ativo**.

1. Com o painel em `http://127.0.0.1:3030/`, na oferta clique em
   **Abrir WhatsApp do painel / verificar sessao**. Se houver QR Code,
   conecte pelo aplicativo oficial do WhatsApp.
2. Depois que as conversas aparecerem, feche **essa janela do WhatsApp
   do painel** para liberar o perfil Playwright.
3. No cartao **Destino WhatsApp**, informe o nome **exato** do grupo ja
   existente, inclusive acentos/emojis, e clique **Salvar grupo**.
   O nome e gravado na `.env` local; configurar o grupo nao envia nada.
4. Com a oferta preservada no painel, clique **Reabrir no WhatsApp**.
   Revise destinatario, imagem e legenda. O envio depende de um clique
   humano confirmado, nao ocorre ao salvar ou reabrir.
5. Se o monitor de ofertas tiver sido pausado durante o diagnostico,
   so reative o ciclo depois de confirmar a janela de revisao.

Se o grupo estiver vazio, o painel agora informa o motivo e bloqueia a
tentativa **antes de abrir o preparador**, preservando a oferta. Uma
pasta de perfil salva nunca mais e rotulada como "Conectado" sem
verificacao ativa. O historico e os arquivos da oferta nao sao apagados
por falha ao preparar a janela.

Testes sem mensagens reais: `npm run typecheck`,
`npm run test:painel-operacional`, `npm run test:whatsapp-grupo`.

## Envio automatico com mouse fisico no computador novo

O destino salvo na configuracao local e reutilizado em todas as ofertas.
A edicao do grupo no painel e opcional, dentro de Alterar grupo.
WHATSAPP_AUTO_SEND_ENABLED=true permite uma unica tentativa fisica de
clique depois que a imagem e a legenda estao prontas. O sistema aguarda
4500ms para mover o ponteiro ate o botao de enviar.
Se o botao nao puder ser validado, nao repetira o clique.
Confirmacao de envio e historico antiduplicacao continuam obrigatorios.
Para desativar: WHATSAPP_AUTO_SEND_ENABLED=false e reiniciar a Central
de Ofertas (porta 3030).

## Mercado Livre: rotacao inteligente de buscas (novo PC)

Sem o `MERCADOLIVRE_QUERIES` no `.env`, agora sao pesquisadas automaticamente as
26 categorias historicas do projeto (`src/fontes/mercadolivre/busca-config.ts`),
e nao apenas smartphone. A rodada percorre tres categorias, com uma quarta
quando houver pouca participacao de ofertas Mercado Livre nas ultimas cinco
publicacoes. O indice de rotacao permanece gravado localmente em `data/`.

O buscador oficial `/products/search` descobre produtos, mas muitos ainda
nao tem publicacoes compraveis em `/products/{id}/items`. O numero limite
de ofertas verificadas nao deve interromper a varredura depois de anuncios
sem desconto. Mantem reputacao de vendedor verde, desconto efetivo real,
valor economizado e historico de anti-duplicidade.

`MIN_DISCOUNT_PERCENT` tem padrao unificado de **20%** na triagem, no log e
na revalidacao. Percentuais e precos sao extraidos apenas de informacoes
oficiais; nunca inventar desconto ou aplicar cupons nao confirmados.

O catalogo publico de cupons do ML pode ficar temporariamente indisponivel.
Nestes casos, usar somente descontos verificados das publicacoes e aguardar
15 min antes de consultar o HTML oficial outra vez; dados observados
recentemente pela extensao ainda podem ser considerados quando validos.

Teste sem enviar mensagens: `npx tsx tests/mercadolivre-descoberta.mts`.
