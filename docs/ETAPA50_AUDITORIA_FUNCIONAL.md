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
[ ] Token Mercado Livre autenticado em consulta real (atual: HTTP 401).
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
