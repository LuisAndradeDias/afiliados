# Laboratorio de botoes WhatyGo - Windows 10 atual, sem Docker

Ambiente experimental isolado para avaliar os botoes Native Flow do WhatsApp.
Nao modifica o Windows, nao instala servicos permanentes e NAO usa a conta
Business de producao. Na primeira etapa, nenhum envio e feito automaticamente.

## Caminho e portas

- Projeto: C:\projeto01\captacao\caca-promos-vip\laboratorio-whatygo
- Central original: http://127.0.0.1:3045 (nao modificar)
- WhatyGo nativo: http://127.0.0.1:4000/manager (apenas localhost)
- PostgreSQL de testes: 127.0.0.1:55432 (instancia portatil isolada)
- PostgreSQL antigo de terceiro: 5432 (NUNCA tocar)

## Origem das dependencias

- Repositorio WhatyGo: https://github.com/lucasgiovannibr/whatygo
- Commit fixado: 6e0abc8c18b162e413bfdb60e0e458f752c066b0
- Go 1.26.8: https://go.dev/dl/go1.26.8.windows-amd64.zip
  SHA-256: b92c3b2adae85a11ba71fe7216daf0d84e82af4c8ab6c5625807f28622043a59
- PostgreSQL 17.11-3 ZIP (EDB): https://get.enterprisedb.com/postgresql/postgresql-17.11-3-windows-x64-binaries.zip
  SHA-256: 4b8db0930c38f6ef845db919551dedda3b6b845aeb0927b3d79a6e8e9e4537cf
- Go e Postgres extraidos em tools/ (nao instalados globalmente).
- Codigo externo em _upstream/ (ignorado no Git principal).
- Cache, sessoes, logs, senhas e bancos em caminhos ignorados pelo Git.

## Primeiro uso no ACER

Sem alterar ExecutionPolicy global:

1. Com dependencias baixadas, executar via PowerShell:
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\configurar-nativo.ps1"
2. Compilar (se bin/whatygo.exe ainda nao existir):
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\construir-nativo.ps1"
3. Iniciar apenas este ambiente:
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\iniciar-nativo.ps1"
4. Diagnosticar:
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\verificar-nativo.ps1"
5. Abrir http://127.0.0.1:4000/manager
6. A chave GLOBAL_API_KEY fica em .env.native (arquivo privado no ACER).
7. Finalizar: powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\parar-nativo.ps1"

Os atalhos .cmd podem ser usados para os passos 3 a 7. O script do banco
usa apenas seu cluster em runtime\pgdata, sem criar servicos do Windows.

## Por que compilamos o codigo com uma mudanca local?

O WhatyGo original define Addr: ":" + SERVER_PORT e, assim, escutaria todas
as interfaces. O construir-nativo.ps1 altera SOMENTE a copia _upstream para
Addr: "127.0.0.1:" + SERVER_PORT, impedindo exposicao acidental na rede.
Esta alteracao e verificada antes da compilacao.

## Credenciais e isolamento

O script configurar-nativo.ps1 gera SEGREDOS NOVOS separados daqueles da
Central e do antigo compose.yaml. Eles ficam somente em:
- .env.native: senha de acesso ao painel e DSNs privadas
- private/postgres-pass.txt: senha do Postgres de testes
- runtime/pgdata: bancos do laboratorio
- runtime/whatygo.*.log: logs do executavel
- bin/dbdata: estado local do cliente quando aplicavel

Esses arquivos nunca devem ir ao GitHub nem ao Google Drive.

## Teste de botoes (apenas depois de subir e verificar)

- Conectar por QR Code somente UMA conta remetente de teste separada,
  nunca o WhatsApp Business usado para publicar as promocoes.
- Destinatario com autorizacao: numero pessoal de testes com final 1632.
- Um unico convite inicial, somente apos confirmacao humana e conferencia
  do numero; nenhum reenvio automatico se a entrega for incerta.
- Dois quick replies: "Entrar no grupo" e "Nao tenho interesse".
- Eventos a observar: SEND_MESSAGE, BUTTON_CLICK e status de conexao.
- Conferir se a mensagem e os botoes realmente aparecem no telefone.
  HTTP 200, ID ou mensagem "enviada" nao comprovam renderizacao.
- Nao adicionar contato a grupo automaticamente.
- Nao bloquear por botao sem confirmar origem da resposta.
- Sem listas de terceiros, disparos em massa nem contatos de producao.

AVISO: uso de bibliotecas nao oficiais pode gerar restricoes na conta.
O laboratorio nao elimina esse risco: use apenas uma conta descartavel
de testes de que voce e titular.

## Versao Docker

O compose.yaml fica como referencia, mas nao e utilizado nesta maquina
Windows 10 21H2; instalacao nativa e o caminho principal.

## Compilacao no Windows sem compilador C

O projeto upstream depende de github.com/chai2010/webp, que exige CGO.
Para este laboratorio de apenas botoes de texto, preparar-sem-cgo.ps1
substitui o decodificador por golang.org/x/image/webp e desativa
EXCLUSIVAMENTE a conversao de imagem PNG/JPEG para figurinha WebP.
O construir-nativo.ps1 aplica o patch local idempotente e compila com
CGO_ENABLED=0; nenhum compilador C nem modificacao global e necessario.
O binario fica em bin/whatygo.exe e os arquivos externos nao sao
incluidos no Git. Nao utilizar esta compilacao para testar figurinhas.

## Estado validado em 22/10/2026

- WhatyGo compilado diretamente em Windows 10 21H2 (Go 1.26.8).
- GET http://127.0.0.1:4000/health: 200, authDb ok, usersDb ok.
- GET http://127.0.0.1:4000/manager: 200.
- GET http://127.0.0.1:3045/inicio: 200 (Central original intacta).
- Banco de testes apenas na porta 55432 local.
- Nenhuma conta pareada, nenhuma mensagem enviada pelo laboratorio.

## Monitor local de cliques (opcional)

O laboratorio possui um receptor de webhook independente na porta 4011,
sem armazenar numero de telefone, texto de mensagem ou chave de API.

- Executar "Iniciar Monitor de Cliques.cmd".
- Abrir "Abrir Monitor de Cliques.cmd" (http://127.0.0.1:4011).
- No painel WhatyGo, apos criar a instancia de TESTE:
  abrir a instancia > "Webhook e eventos".
- Em URL do webhook, usar: http://127.0.0.1:4011/webhook
- Marcar BUTTON_CLICK, SEND_MESSAGE e CONNECTION, depois salvar.
- Enviar somente UMA mensagem autorizada para o numero de testes,
  verificar os botoes no telefone e clicar em UMA opcao de cada vez.
- A pagina mostra os eventos e o identificador da escolha quando recebido.
- O monitor aceita os codigos aceitar_grupo, recusar_grupo, CPV_ENTRAR
  e CPV_NAO_INTERESSE.
- O arquivo runtime/eventos-botoes.jsonl guarda apenas o tipo do evento,
  nome da instancia, data e a escolha. Ele e ignorado pelo Git.
- HTTP 200 do webhook nao confirma entrega ou representacao visual:
  sempre verificar no aparelho.
- Para interromper o monitor: executar powershell.exe -NoProfile
  -ExecutionPolicy Bypass -File ".\parar-monitor.ps1".

Se o evento chegar com "Opcao nao identificada", conferir o formato do
webhook antes de integrar. Nunca automatizar inclusao em grupo neste teste.

## Teste real de botoes entre dois numeros (22/10/2026)

Correcao de papeis confirmada com o usuario:
- REMETENTE: WhatsApp principal, numero brasileiro com final 1632.
- DESTINATARIO: WhatsApp de testes, numero brasileiro com final 4306.
- Nome da instancia no WhatyGo: "cpv-lab-remetente-4306" (nome historico;
  NAO representa o numero de envio). Ela foi pareada com a conta principal.
- O JID da instancia continha sufixo ":dispositivo"; apos separar esse
  sufixo, o numero de origem foi verificado como o principal, final 1632.
- Instancia antiga "teste" preservada e desconectada na ultima verificacao.
- CONNECT_ON_STARTUP permanece false.

Verificacoes e envio:
- WhatyGo: http://127.0.0.1:4000/health respondeu HTTP 200.
- Monitor: http://127.0.0.1:4011/status ativo.
- Consulta /user/check confirmou que o destinatario final 4306 tem WhatsApp.
- O script enviar-convite-unico.ps1 guarda o JID completo esperado apenas
  em private/remetente-autorizado-jid.txt e o destinatario apenas em
  private/numero-destinatario-teste.txt. Esses arquivos NAO vao ao Git.
- O script confere sessao, nome da instancia, token, JID exato e os dois
  numeros aprovados antes de permitir o envio.
- Foi executado o envio real UNICO para o destinatario final 4306.
- API /send/button retornou "success" com ID da mensagem presente.
- O monitor recebeu um evento SEND_MESSAGE na instancia correta.
- A entrega visual e o clique no celular ainda precisam ser confirmados
  pelo destinatario. Ate aqui nao houve BUTTON_CLICK real.

PROXIMA ACAO: verificar no WhatsApp final 4306 se os dois botoes chegaram
ativos; clicar em "Entrar no grupo" OU "Nao tenho interesse"; verificar o
evento BUTTON_CLICK no monitor local http://127.0.0.1:4011.

Protecoes:
- Lock criado em private/convite-um-unico-envio.lock ANTES da chamada HTTP.
  O script bloqueia qualquer segunda tentativa, mesmo com timeout.
- NAO apagar o lock para repetir sem analise manual do que ocorreu.
- A resposta recebida nao modifica contatos, grupos nem filas de producao.
- Webhook em localhost e laboratorio nao eliminam o risco de conta:
  WhatyGo usa conexao nao oficial do WhatsApp.
- Os testes sinteticos de ButtonClick foram apagados antes do envio real.

## Painel editavel: envio manual de 1, 2 ou 3 botoes (22/10/2026)

Agora o proprio Manager em http://127.0.0.1:4000/manager oferece o modelo
"Caça Promos VIP — Personalizado" em Instancias > Testar envio > Botoes.

Campos personalizaveis:
- Numero do destinatario autorizado: 55+DDD+numero (ou DDD+numero, o
  formulario acrescenta 55 em numeros brasileiros de 10/11 digitos).
- Titulo, texto completo da mensagem e rodape.
- Quantidade de quick replies: 1, 2 (padrao) ou 3.
- Rotulo e ID de resposta de cada botao. Os dois IDs padrao sao
  aceitar_grupo e recusar_grupo, compativeis com o monitor local.
- Previa JSON e cURL atualizada sem realizar envios.
- Confirmacao do consentimento do destinatario e do numero antes de enviar.
  A confirmacao e desmarcada ao editar destino, texto ou botoes.
- Protecao contra clique duplo durante a requisicao.
- O envio continua MANUAL, individual, sem filas ou disparos programados.
- O titulo e a mensagem padrao reaparecem quando o formulario e reaberto.
- Nenhum numero pessoal fica gravado no codigo publico do patch.

Arquivos versionados:
- painel-botoes-personalizados.patch: diferenca aplicada apenas nos arquivos
  React do Manager que vivem na copia _upstream ignorada pelo Git principal.
- publicar-painel-whatygo.ps1: publica a compilacao somente apos validar e
  preservar um backup da versao anterior; possui rollback (-Restaurar).

Para reaplicar apos restaurar a copia limpa do WhatyGo (commit pinado):
1. No repositorio _upstream: git apply ..\painel-botoes-personalizados.patch
   (na pratica, utilize o caminho absoluto para o arquivo patch).
2. Na pasta _upstream\manager: npm.cmd ci --no-audit --no-fund.
3. Na pasta _upstream\manager: npm.cmd run typecheck; npm.cmd run test.
4. Na pasta _upstream\manager:
   npm.cmd run build -- --outDir dist-cpv-stage
5. Na pasta do laboratorio:
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File
   ".\publicar-painel-whatygo.ps1" -Publicar

Para restaurar rapidamente apenas o frontend anterior:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File
".\publicar-painel-whatygo.ps1" -Restaurar

A pasta de backup privada fica em runtime\manager-dist-before-custom.
O servidor de Go continua na porta 4000, sem reiniciar nem alterar sessoes.
Os testes sao locais: a entrega/click do WhatsApp continuam nao garantidos
por serem uma integracao nao oficial. Nunca enviar para quem nao autorizou.

## Ponte de cliques para a Central 3045 (ativada em 22/10/2026)

O webhook é protegido por segredo local, armazenado exclusivamente em
`private/webhook-recebimento-chave.txt`. O monitor autentica a URL, valida
a origem local e encaminha só os campos de evento necessários para
`127.0.0.1:3045`, por outra chave mantida nos dados privados da Central.

Página de operação:
`http://127.0.0.1:3045/respostas-botoes`

Para conferir ou reaplicar a ligação depois de um restart:
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File
  ".\\sincronizar-webhook-central.ps1"`
Usar `-Aplicar` apenas para configurar o webhook (não envia mensagens).

A conexão WhatyGo → monitor → Central utiliza a instância já pareada;
o nome histórico da instância termina em 4306, mas o remetente verdadeiro
é a conta principal verificada previamente. O script compara o número do remetente ao JID privado preservado,
permitindo a rotação do sufixo do aparelho após reconexões; não deixa
números pessoais no Git.

As recusas validadas usam o bloqueio existente mesmo se não houver cadastro.
Os aceites apenas entram na fila de revisão manual de consentimento e grupo.
Se o remetente vier como LID não resolvido, grupo, auto-resposta ou identidade
ambígua, a Central não aplica bloqueios nem autorizações.

Cliques antigos do monitor tinham só opção e data, sem remetente.
Portanto, NÃO são vinculados automaticamente a contatos. Somente novos
cliques recebidos após ativar o webhook autenticado terão identidade.
Nenhuma publicação ou instalação altera as sessões WhatsApp nem envia algo.

## Correcao do clique que nao aparecia no painel (22/10/2026)

Problemas diagnosticados a partir dos eventos reais:
1. O monitor procurava `whatygo-ponte-chave.txt` em `dados/`,
   mas a Central ativa na porta 3045 guarda seu estado em
   `dados/previa-acer/`. O encaminhamento recebia erro e retornava HTTP 503.
2. Apos reconectar o WhatsApp, o JID manteve o MESMO numero de telefone,
   mas trocou o sufixo :dispositivo. A ponte tratava isso como uma nova
   conta e rejeitava o evento. Agora validamos o numero e a instancia, e
   rejeitamos numeros distintos, LID, grupo ou sessao desconectada.

Mudancas adicionais:
- O monitor exibe `bridge.keyPresent`, ultima falha e numero de cliques
  encaminhados em http://127.0.0.1:4011/status, sem guardar telefones brutos.
- Cada clique recebido pelo monitor e registrado mesmo se a Central falhar,
  marcado como `falha-ponte`; HTTP 503 permite tentativa de entrega posterior.
- Retransmissoes do mesmo ID de mensagem/botao sao deduplicadas visualmente.
- Um diagnostico em `POST /diagnosticar-ponte?key=<segredo-privado>` exercita
  o fluxo completo, utilizando uma opcao que a Central IGNORA. Nao grava
  clique, nao altera cadastro e nao envia mensagem. Nao compartilhar URL.
- Testes de regressao: `tests/whatygo-ponte-identidade.test.mjs`.

Os cliques que falharam antes da correcao nao podem ser atribuidos
retroativamente se a mensagem bruta nao tiver sido preservada pelo WhatyGo.
A conta remetente e a sessao existente nao foram substituidas.
