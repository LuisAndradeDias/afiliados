# Etapa 50 — Auditoria funcional e homologacao segura

Data: 2026-10-27.
Branch: feat/etapa50-homologacao-segura (base: PR #48, Etapa 49).
Estado: auditoria e correcoes testadas em ambiente de desenvolvimento ISOLADO.
NAO houve deploy em C:\projeto02, merge na main, envio WhatsApp,
renovacao OAuth ou publicacao de oferta.

## Proposito e limitacoes

Validar Mercado Livre, Amazon, WhatsApp e Campanhas com dados ficticios,
antes de passar a testes supervisionados com credenciais e sessoes reais.
Sinais de conexao e existencia de arquivos nao devem ser tratados como
comprovacao de envio, preco, autenticacao ou link de afiliado.

## Diagnostico read-only do ACER

Painel 3030 e Campanhas 3040 responderam na auditoria.
Somente C:\projeto02 e instalacao ativa na raiz do disco.
Codigo de desenvolvimento e backups continuam sob
%LOCALAPPDATA%\Projeto04, oculto e com permissoes restritas.

### Mercado Livre — duas pendencias reais, nao resolvidas

1. API: apenas UMA solicitacao GET autenticada foi enviada ao endpoint
   de busca do Mercado Livre, sem token refresh e sem salvar resposta.
   HTTP 401. O campo de expiracao no .env indica token vencido havia
   cerca de 17 horas no momento da checagem. Refresh token e app
   configurados, mas NAO foi executada rotacao para evitar invalidar
   credenciais em uso. O painel indicava configuracao pronta, o que
   era insuficiente para provar acesso real.
2. Extensao: em Chrome Profile 10, a extensao local do Meli estava
   registrada em C:\projeto01\browser-extension\mercadolivre-affiliate,
   caminho ja removido. A pasta correta existe em
   C:\projeto02\browser-extension\mercadolivre-affiliate.
   O servidor reporta heartbeat recente, mas heartbeat e apenas um ping;
   nao comprova instalacao com caminho valido nem link gerado.
   Nenhuma Secure Preferences, sessao ou cookie do Chrome foi editado.

### Consulta/variedade ML

O arquivo de exemplo .env.example recomenda tres consultas ML por rodada,
mas a instalacao real usa MERCADOLIVRE_QUERIES_PER_RUN=1. Um teste legado
ainda exigia duas no exemplo; a expectativa foi corrigida para tres.
A instalacao real continua em uma consulta por rodada, SEM alterar
limites nem consumo de API. Nao aumentar ate validar rate limiting.

### Amazon

Tracking ID presente conforme booleano do painel. Testes com HTML
sintetico exercitaram preco anterior, descontos, cupons e seletor de
ofertas. A autenticacao no site e precos de mercado em tempo real
ainda NAO foram validados nesta etapa.

### WhatsApp e Campanhas

Grupo configurado; pasta do perfil WhatsApp existe, mas a sessao autenticada
nao foi confirmada por uma operacao real. Monitor e autoenvio desligados,
operacao pausada, sem envios pendentes e sem processos de busca ativa.
O endpoint /saude da Captacao devolve HTTP 200 em texto simples,
nao JSON; o novo auditor foi ajustado para reconhecer corretamente
a resposta sem exibir seu corpo.

Testes simulados de consentimento, descadastro, bloqueios, historico,
intervalos, fila e tentativa incerta passaram parcialmente. Em uma
execucao agrupada, os arquivos de teste desbloqueio-contatos.test.mjs
e envio-rapido.test.mjs deixaram processos de teste abertos mesmo
apos as assercoes iniciais passarem. Apenas os processos Node de teste
isolados foram encerrados; nao contar esses dois arquivos como
aprovados ate investigar o encerramento de recursos.

## Melhorias implementadas SOMENTE na branch da Etapa 50

- Script scripts/etapa50/diagnostico-local.mjs somente leitura.
  Le Secure Preferences apenas para indicadores de caminhos de
  extensao e faz dois GETs HTTP locais; nao imprime IDs de extensao,
  caminhos dos perfis, grupos, tokens, contatos ou logs. Nunca envia.
  Aceita --root, --chrome-data, --dashboard, --capture, --no-http
  e --json para testes com fixtures.
- Testes do auditor usam perfis e respostas sintéticas e verificam
  que nenhum POST nem valor privado foi enviado.
- README da extensao documenta o novo caminho em C:\projeto02 e o
  procedimento de recadastramento manual, sem alterar Chrome a mao.
- O painel de desenvolvimento troca "API conectada"/"pronta" por
  "Token salvo (acesso nao verificado)" e "Extensao respondeu".
  Um ping sozinho nao deixa mais o indicador verde sem job concluido.
  O status de WhatsApp segue apenas "perfil salvo, login nao verificado".
- Teste de variedade alinhado ao modelo de tres consultas; instalacao
  em execucao NAO recebeu mudancas de configuracao.
- Teste visual headless (fixture local) valida os rótulos novos.
- Workflow CI executa diagnostico, simulacoes e typecheck, sem sessoes
  reais ou APIs externas.

## Passos para homologar o Mercado Livre (com o usuario no computador)

1. Abrir no Chrome o perfil correto (Profile 10) e acessar
   chrome://extensions.
2. Confirmar que a extensao local Meli aponta a C:\projeto01.
   Remover somente essa entrada antiga; usar "Carregar sem compactacao"
   na pasta C:\projeto02\browser-extension\mercadolivre-affiliate.
   Nao limpar dados de navegacao nem mexer nas demais extensoes.
3. Confirmar no auditor que o registro antigo deixou de existir.
   Um heartbeat so indica ping; ainda precisa testar gerador oficial.
4. Pelo painel, usar a opcao "Conectar Mercado Livre" se uma renovacao
   controlada nao recuperar o acesso. Manter um backup criptograficamente
   verificado e nunca restaurar token rotativo antigo sobre token novo.
5. Apos acesso API confirmado, executar UMA busca de teste sem ligar
   o monitor. Validar id, disponibilidade, preco anterior comprovado,
   reputacao elegivel, cupom e URL produto. Gerar UM link oficial e
   conferir seu destino de afiliado sem publicar no WhatsApp.
6. Com sessao WhatsApp validada, testar o envio apenas para destino
   controlado e autorizado, com confirmacao humana. Conciliar
   resultado incerto sem duplicar mensagens; documentar sucesso
   antes de considerar o monitoramento automatico.

## Critérios de conclusao da Etapa 50

[x] Diagnostico read-only e provas sintéticas; sem exposicao de dados.
[x] Erro de teste de variedade corrigido sem alterar .env real.
[x] Advertencias do painel corrigidas na branch de desenvolvimento.
[x] Configuracao WhatsApp e perfis preservados.
[x] Token Mercado Livre renovado e autenticado (GET do catálogo: HTTP 200).
[ ] Extensao Meli registrada no Chrome usando C:\projeto02.
[ ] Link Meli gerado e conferido pelo mecanismo oficial.
[ ] Ofertas Amazon reais, precos, cupons e links conferidos.
[ ] Fluxo WhatsApp end-to-end confirmado sob supervisao.
[ ] Investigar dois testes de Captação que deixam handles abertos.
[ ] Revisao/merge de PRs-base e deploy controlado com rollback.

A Etapa 50 AINDA NAO ESTA CONCLUIDA operacionalmente e a automacao
nao deve ser ligada com base apenas nos testes simulados.


## Evidencias de testes na branch isolada

- 14 arquivos de teste de motores e integracoes, com 35/35 verificacoes
  aprovadas apos corrigir a expectativa obsoleta do modelo de consultas.
- 2/2 testes do diagnostico read-only aprovados, incluindo /saude
  respondendo como texto simples e nenhuma chamada HTTP POST.
- Simulacao visual tests/painel-operacional.mts aprovada em Chrome
  headless sem carregar perfis de usuario ou abrir o WhatsApp real.
- npm run typecheck aprovado.
- Captacao: assercoes de consentimento, bloqueio, reservas e ausencia
  de disparos passaram, mas o runner foi interrompido devido a dois
  arquivos com handles abertos; nao contar como suite totalmente aprovada.
- Consulta real somente GET ao Mercado Livre: HTTP 401, nenhum dado
  de produto validado, nenhum token renovado.


## Atualizacao operacional — renovacao real e hotfix discreto (27/10/2026)

Este bloco SUPERA o diagnostico inicial de API HTTP 401 acima, que foi
feito ANTES da renovacao. Nao altera a conclusao de que a Etapa 50
ainda precisa de homologacao de links e WhatsApp.

**Credenciais ML recuperadas**
- Codigo de autenticacao em C:\projeto02 e branch Etapa 50 comparado;
  mesma logica, com diferencas exclusivamente CRLF/LF.
- Copia pre-rotacao da configuracao guardada com criptografia DPAPI
  no diretorio protegido %LOCALAPPDATA%\Projeto04\reserva, validada
  por SHA-256 de ida e volta. O refresh token antigo e de uso unico:
  essa copia NAO deve ser restaurada automaticamente, pois invalidaria
  a credencial nova.
- Uma unica execucao de npm run mercadolivre:auth-check no ambiente
  ativo renovou com sucesso o access token e refresh token, persistindo
  ambos no .env atual. O lock foi removido normalmente. Nenhum valor
  de token foi exibido, nem enviado ao Git.
- Consulta oficial GET /products/search autenticada respondeu HTTP 200
  com resultado e data de expiracao de aproximadamente seis horas.
  Nenhum envio, link gerado, refresh adicional ou automonitoramento.
- Na amostra real controlada de tres catalogos, houve dois retornos
  de detalhes HTTP 404 e um HTTP 200 com dois anuncios com preco. Zero
  precos anteriores comprovados, zero disponibilidades positivas
  evidenciadas e zero vendedores verdes confirmados. Bulk de
  reputacao respondeu HTTP 200. NAO representa oferta pronta.

**Hotfix visual ja aplicado ao Acer**
- O arquivo C:\projeto02\src\painel\public\index.html recebeu SOMENTE
  os ajustes visuais da Etapa 50 para nao exibir token/heartbeat como
  API e extensao comprovadamente prontas. Foram exatamente 5 linhas
  inseridas e 4 removidas, confirmadas com git diff ignorando EOL.
- Backup original do HTML guardado na reserva protegida com hash
  verificado. Instalacao atomica com caminho de backup explicito,
  testada e validada em GET / e /ofertas (HTTP 200 e mensagens novas).
  A rota /central serve uma pagina diferente e nao verifica o
  conteudo do HTML de ofertas. Nenhum servidor foi reiniciado.
- A extensao localizada em C:\projeto02 agora possui manifest
  discreto: nome "Conector 02", versao 0.4.1, mesma permissao, hosts
  permitidos, scripts e worker da versao anterior. Backup preservado.
  Os arquivos no disco foram atualizados; o Chrome Profile 10 AINDA
  registra a extensao pelo caminho extinto C:\projeto01.
  Necessario remover SOMENTE aquela extensao antiga e carregar a
  pasta C:\projeto02\browser-extension\mercadolivre-affiliate
  por chrome://extensions, sem apagar perfis/cookies nem editar
  Secure Preferences manualmente.

**Seguranca e liberacao**
- Monitor Amazon/ML e WhatsApp autoenvio seguem desativados.
- A integracao de link oficial via extensao ainda nao foi testada
  com sessao real. Nenhum WhatsApp enviado e nenhum grupo alterado.
- A Etapa 50 continua em draft, sem aprovar merge/deploy automatico.
- Novos testes estaticos garantem que a extensao continue sem
  referencias comerciais no nome visivel e sem ampliar permissoes.


## Validacao do Conector 02 apos recadastro — 27/10/2026

Confirmado em Secure Preferences do Chrome Profile 10: apenas uma
extensao local de Mercado Livre, registrada no endereco
C:\projeto02\browser-extension\mercadolivre-affiliate, manifest
"Conector 02" v0.4.1. O antigo caminho C:\projeto01 nao foi
encontrado. O heartbeat com o painel 3030 foi confirmado.

Foram executados DOIS testes controlados de geracao de link, sem
publicar produto, alterar campanhas ou ativar WhatsApp/monitor.
Ambos usaram somente uma oferta temporaria com titulo explicito
"TESTE TECNICO INTERNO - NAO PUBLICAR", categoria de laboratorio
e preco/desconto zerados, criada exclusivamente se o arquivo
ultima-oferta-mercadolivre.json nao existisse.

- Tentativa 1: job permaneceu "pending" por 110 s, sem que a
  extensao assumisse o pedido. O probe marcou erro e removeu a
  oferta de teste. Sem envio ou link salvo.
- Solicitada abertura da pagina oficial do portal de afiliados no
  Chrome Profile 10. O painel 3030 foi reiniciado em estado pausado,
  sem mexer na Captacao 3040, para limpar o job de teste antigo.
- Tentativa 2: job mudou para "running" e a extensao iniciou
  o gerador, comprovando o fluxo navegador -> painel. Falhou com
  diagnostico de BOTAO GERAR DESABILITADO. O codigo sugere como
  hipoteses a ausencia de etiqueta/tag selecionada ou URL que o
  portal nao aceita; nenhuma delas foi confirmada individualmente.
  A extensao tenta selecionar opcao padrao ou unica, mas nao escolhe
  arbitrariamente entre varias etiquetas.
- A oferta temporaria foi removida e os monitores, autoenvio e filas
  permaneceram desligados e sem mensagens pendentes. O servidor 3030
  foi novamente reiniciado em seguranca para apagar o job de erro;
  Captacao 3040 manteve o mesmo processo. Nao ficou link afiliado
  de teste gravado no runtime.

Para concluir: no mesmo Chrome Profile 10, abrir o portal oficial
do Mercado Livre/Afiliados, entrar no Gerador de Links, selecionar
manualmente a etiqueta/tag correta e verificar que o botao Gerar
fica habilitado para um produto elegivel. Nao criar/publicar campanha
ou alterar contatos. Se o botao permanecer desabilitado, registrar
apenas descricao da mensagem e captura recortada sem credenciais.
Executar entao mais um teste SEM WhatsApp, com confirmacao humana.

O script scripts/etapa50/teste-link-controlado.ps1 foi versionado
para repetir essa verificacao de forma supervisionada. Requer o
parametro EXPLICITO -ConfirmarTesteManual; sem ele, falha antes de
ler a configuracao ou alterar arquivos. Em caso de teste com resultado
terminal, remove a oferta temporaria, nao copia links/credenciais
para o Git e deixa o monitor pausado. Nao executar pelo CI.

Resumo: EXTENSAO_INSTALADA=true; FLUXO_JOB_ATIVO=true;
LINK_OFICIAL_CONFIRMADO=false; WHATSAPP_ENVIOS=0;
ETAPA50_APROVADA=false.


## Diagnostico por captura do Gerador de Links — 27/10/2026

O usuario mostrou a tela https://www.mercadolivre.com.br/afiliados/linkbuilder#hub
com campo preenchido com /p/MLB62255501, uma etiqueta existente
JA SELECIONADA e botao Gerar desabilitado. A mensagem anterior de
erro citava a etiqueta, mas isso nao demonstrava sua ausencia.

Verificacoes oficiais somente GET, com autenticacao atual:
- catalogo MLB62255501 respondeu HTTP 200, status active;
- /products/MLB62255501/items respondeu HTTP 404;
- outro catalogo (MLB52863150) respondeu /items HTTP 200 com dois
  anuncios novos com preco. Nao foi comprovado que o portal aceite
  aquele produto; isso requer teste controlado.
- /items/MLB4558025475 respondeu HTTP 403 por politica da API,
  portanto nao presumir URL canonica de anuncio a partir desse dado.
- Mercado Livre orienta usar URL da pagina individual de produto,
  nao paginas gerais ou de busca. Um catalogo ativo sem anuncios
  consultaveis nao deve ser escolhido como referencia de teste.

Correcoes na branch:
- teste-link-controlado.ps1 agora valida /products/{id}/items
  e so usa um catalogo com anuncio novo e preco; ignora HTTP 404,
  interrompe HTTP 429/401/403 e nao envia mensagem.
- content.js passou a aceitar tambem URLs individuais HTTPS
  de anuncios /MLB-12345-..._JM do dominio oficial, mantendo
  validacao restrita de protocolo, host, usuario, senha e porta.
- 20 linhas corrompidas de background.js e content.js foram
  reparadas com escapes Unicode; mensagens de erro no navegador
  deixam de apresentar caracteres de substituicao U+FFFD.
- Mensagem de botao Gerar desabilitado agora esclarece que a
  etiqueta pode estar correta, e sugere verificar elegibilidade e URL.
- Versao da extensao Conector 02 incrementada para 0.4.2.

Importante: os arquivos no disco nao recarregam automaticamente
a extensao ativa no navegador. Atualizar o codigo na instalacao
e usar RECARREGAR no cartao Conector 02 em chrome://extensions
sem remover sessao ou demais extensoes. Depois testar com
uma URL real de anuncio individual e, somente se o usuario
autorizar, repetir um probe controlado sem WhatsApp.

Nenhum link oficial foi confirmado por causa desta captura.


## Bloqueio de produto indisponivel em todas as etapas (27/10/2026)

A captura enviada pelo proprietario mostra uma pagina de produto
com a mensagem "Este produto esta indisponivel no momento".
Uma pagina de catalogo em status=active nao prova que existe um
anuncio compravel; nao aproveitar esse status para publicar.

Implementacao segura (falha fechada):
- Na busca: exige anuncio novo e com preco, vendedor de reputacao
  aceita, /products/{id} ativo, buy_box_winner existente e com
  available_quantity positivo, mesmo anuncio e vendedor vencedor,
  e preco coerente. Sem essa evidencia, oferta descartada.
- Na analise editorial: desconto nunca contorna disponibilidade
  ausente, estoque zero ou verificacao mais antiga que 10 minutos.
- Antes de solicitar link a extensao: consulta novamente a API.
- Antes de montar mensagem do Mercado Livre: consulta novamente.
- No processo WhatsApp: verifica antes de abrir a sessao e
  novamente imediatamente antes da acao de envio. Falha/403/404/
  429/timeout ou estoque desconhecido bloqueia.
- No teste manual do link: nao usa apenas o primeiro catalogo
  retornado. Verifica anuncio vencedor, preco e estoque; nao
  exige gerar promocao para provar que o conector funciona.
- O Mercado Livre pode ocultar available_quantity da lista
  de anuncios de terceiros. A quantidade EXPLICITA na buy box
  oficial pode suprir a quantidade ausente da lista, mas NUNCA
  um zero declarado, um vencedor ausente ou uma API sem resposta.
- Nao tratar a quantidade publica como estoque exato. A informacao
  pode ser aproximada e mudar imediatamente; revalidacao reduz
  o risco, mas nao garante o checkout de todo destinatario.

Documentacao externa: API de competicao no catalogo
(developers.mercadolivre.com.br/concorrencia-em-catalogo) e
recursos de Itens e Buscas (developers.mercadolivre.com.br/pt_br/itens-e-buscas).

Evidencia de teste: tests/mercadolivre-disponibilidade.mts e
tests/mercadolivre-estoque-integracao.mts usam mocks. Exemplo:
catalogo ativo com buy_box_winner=null ou estoque=0 nao gera
oferta; catalogo com vencedor e estoque positivo pode prosseguir
mesmo sem available_quantity no /items de terceiros. Teste
sem token real, envio WhatsApp ou publicacao.


## Etapa 50 — teste manual desacoplado de ofertas (27/10/2026)

**Causa do bloqueio funcional:** o teste anterior usava um item nao
compravel. Depois da protecao de disponibilidade, o teste estrito
consultou oito catalogos e nao encontrou nenhum vendedor vencedor
com estoque positivo: cancelou-se antes de criar qualquer pedido.
Uma consulta de amostragem por GET a nove catalogos ativos, em
tres categorias, retornou HTTP 200 para todos, mas todos tinham
buy_box_winner ausente. Isso NAO prova que todos estejam fora de
estoque: apenas que a API nao forneceu a confirmacao necessaria.
O recurso /products/MLB52863150/items deu dois anuncios com preco,
mas /items/bulk devolveu status_code 403 para o detalhe individual.
Consulta publica via navegador Playwright isolado (sem cookies)
recebeu HTTP 403, sem acesso para comprovar botao de compra. Nenhuma
tecnica de contorno de acesso foi utilizada.

**Novo caminho tecnico preparado:** um modo independente de
diagnostico do Gerador de Links do Mercado Livre, exclusivamente
para URL manual de produto:
- Acao local mercadolivre-link-diagnostico exige confirmacao literal
  TESTE_LINK_SEM_ENVIO, URL HTTPS em hostname oficial e caminho de
  produto validado, sem rastreadores, grupo, oferta ou arquivo de
  mensagem existente; so funciona com extensao conectada e ciclo
  pausado, monitor e autoenvio desativados.
- O pedido usa o mesmo canal da extensao, mas recebe flag
  diagnostico=true, visivel como mercadoLivreTesteLinkJob; a UI
  nao mostra o teste como link promocional salvo.
- Callback da extensao apenas reconhece meli.la ou /sec HTTPS.
  **Nao grava** arquivo de ofertas, link, mensagem nem inicia qualquer
  fluxo WhatsApp. Um link reconhecido nao prova destino nem estoque.
- Limpeza de estado via acao mercadolivre-link-diagnostico-limpar
  com confirmacao. Pedido pendente tem expiracao de dois minutos.
- A acao e negada para origens HTTP externas ao painel local.
- Script manual em scripts/etapa50/diagnosticar-url-manual.ps1
  exige -ConfirmarTesteManual e -UrlProduto; verifica estado antes,
  acompanha resultado e remove apenas o proprio job. Sem esses
  parametros, recusa antes de acessar o painel.
- A operacao normal de busca, aprovacao, links e WhatsApp continua
  exigindo buy_box_winner e estoque e nao usa esse modo diagnostico
  como criterio de produto publicavel.

**Testes:** unitarios verificam rejeicao de URL de terceiro e
estado inseguro. Integracao local isolada em porta separada e sem
credenciais/sessao reais simula heartbeat, job, callback com URL
sintetica e limpeza; verifica que nao existe nenhum arquivo de
oferta nem WhatsApp. Nao houve geracao real de link nesta etapa.

**Pendencia pratica:** obter uma URL individual de produto
comprovadamente compravel (botao Adicionar ao carrinho ou Comprar
ativo no Chrome Profile 10) e, apos consentimento do usuario,
executar UM teste manual de link sem WhatsApp. Recarregar o
Conector 02 se o codigo do content script ainda estiver antigo.
Nao usar um produto da captura que aparece indisponivel.

## Etapa 50 — URL completa de produto na extensao (28/10/2026)

O usuario forneceu screenshot de produto compravel no Chrome Profile 10:
catalogo MLB38053317, parafusadeira The Black Tools. Na captura,
o portal exibe botao Comprar agora habilitado, estoque disponivel
e preco no Pix; essa comprovacao visual NAO substitui a verificacao
de compra/estoque para publicar uma oferta, nem confirma que o
anuncio seja elegivel para o programa de afiliados.

Foi identificado que o modo manual de diagnostico transformava
a URL real com slug
  /parafusadeira-e-furadeira-impacto-the-black-tools-.../p/MLB38053317
em
  /p/MLB38053317
antes de entregá-la ao linkbuilder. O guia oficial do Mercado Livre
orienta usar a URL copiada da pagina individual do produto;
a reducao podia fazer o gerador rejeitar o endereco.

Hotfix v0.4.3: o validador da Central preserva o slug de um produto
com dominio oficial e retira so query/hash (tracking), rejeitando
caminhos extras/suspeitos e mantendo limite de comprimento.
A extensao aceita esse caminho completo e foca o input antes dos
eventos de preenchimento. O status de diagnostico aprovado diz
explicitamente que o link NAO foi salvo/publicado, para evitar
promessas incorretas.

A validacao por simulacao reproduziu URL longa com botao Gerar
habilitado apenas apos input, etiqueta pre-selecionada e resposta
ficticia meli.la; os testes de URL malformada, dominio externo,
mensagem e WhatsApp continuaram aprovados. Nenhuma compra,
sessao WhatsApp ou promocao publicada.

A causa da falha real ainda NAO foi comprovada. Depois de
recarregar Conector 02 v0.4.3, realizar no maximo um teste
manual protegido com a URL real e os monitores desligados.
Se o portal recusar, conferir manualmente se a mesma URL
colada pelo usuario habilita o botao. Isso separa falha do
preenchimento automatico de possivel restricao do afiliado.
