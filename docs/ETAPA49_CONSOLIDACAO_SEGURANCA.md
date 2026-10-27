# Afiliados 2.0 — Etapa 49: consolidacao e seguranca

Data da auditoria: 2026-10-27.
Base de codigo: branch da Etapa 48, PR #46 (commit 59743bc56f75f86a5795ef85ec3db093f873f995).
Status: melhorias de seguranca em branch isolada; sem merge, sem deploy e sem ativar automacoes.

## Objetivo

Estabelecer uma fonte versionada para a proxima evolucao, revisar a privacidade local,
medir divergencias entre o codigo no GitHub e a homologacao do ACER e impedir
a inclusao acidental de dados privados em novos commits.

Esta etapa NAO unifica fisicamente os backends, NAO altera a instalacao ativa e
NAO constitui aprovacao de envio de mensagens ou ativacao em producao.

## Diagnostico no ACER — observacao sem alteracao operacional

- A instalacao de homologacao permanece em C:\afiliados-v2-homologacao; a
  instalacao legada, em C:\projeto01. A pasta de homologacao e uma copia
  sem diretorio Git, por isso nunca executar git pull ali ou sobrescreve-la
  com arquivos de uma branch nao reconciliada.
- A porta 3030 (Ofertas/Central/Shopee) e a porta 3040 (Captacao/Campanhas)
  estavam ouvindo apenas 127.0.0.1; 3045 estava livre. As cinco rotas
  verificadas responderam HTTP 200. Isto nao prova envio real ou login.
- As pastas de homologacao, legado e backup ja tinham atributo oculto
  e ACL restrita a usuario atual, Administradores e SYSTEM. Arquivo .env
  e perfil WhatsApp da homologacao tambem apresentaram ACL restrita.
- Os flags ALTERNATING_MONITOR_ENABLED, MERCADOLIVRE_MONITOR_ENABLED e
  WHATSAPP_AUTO_SEND_ENABLED estavam todos explicitamente false na
  configuracao local. Nenhum modo de autoenvio foi ligado.
- Existiam tres pastas principais em C:\BackupsAfiliados, protegidas por
  ACL. A restauracao INTEGRAL desses backups ainda nao foi homologada.
- A branch local do legado e feat/convites-whatsapp-web-supervisionado,
  enquanto o GitHub main possui apenas a historia anterior. Nao alterar
  o legado como parte desta consolidacao.
- Comparacao dos arquivos operacionais versionados da branch PR #46 com
  a homologacao: 119 arquivos analisados, 119 equivalentes em conteudo,
  0 alteracoes de texto e 0 ausentes. Destes, 113 diferem somente no
  formato de quebra de linha (CRLF/LF).
- A checagem de nomes de arquivos rastreados nesta branch nao identificou
  dados locais, perfis ou credenciais; apenas modelos .env.example aparecem
  entre caminhos com prefixo .env. ISSO NAO substitui uma varredura de
  conteudo historico nem garante ausencia de segredos no GitHub.

## Codigo separado e protegido

Foi criado um checkout independente do PR #46 dentro do perfil local do
Windows, em pasta reservada a trabalho tecnico, com permissoes explicitas
apenas para a conta do usuario, Administradores e SYSTEM. Esta pasta nao
possui copia de .env, contatos, filas, historicos de envio nem perfil de
WhatsApp. A instalacao da porta 3030 e a Captacao 3040 nao foram paradas.

A branch desta entrega parte do PR #46 e sera publicada como PR em
rascunho, com base na branch da Etapa 48. Nenhum PR sera mesclado
automaticamente a main.

## Protecoes adicionadas na Etapa 49

1. Arquivo .gitignore ampliado para variantes de .env, arquivos de
   certificados/chaves, SQLite, diagnosticos locais e outras pastas de
   execucao. Exemplos .env.example continuam permitidos. IMPORTANTE:
   .gitignore nao remove segredos ja presentes no historico.
2. Auditor PowerShell read-only em
   scripts/windows/auditar-consolidacao-etapa49.ps1.
   Ele verifica ACL, atributo oculto, ligacao de portas ao loopback,
   existencia de backups, flags de automacao, nomes sensiveis rastreados
   e equivalencia textual de arquivos operacionais versionados.
   Nao grava arquivos, nao le conversas, nao envia mensagens, nao faz
   OAuth e nunca imprime valores de credenciais ou contatos.
3. Suite tests/auditoria-etapa49.test.mjs com entradas sinteticas,
   inclusive segredo artificial, para garantir ausencia de vazamento,
   flags negativas fail-closed e cobertura das regras de .gitignore.
4. Workflow Windows isolado de CI para auditoria e regressao sem dados
   reais, browsers de producao ou WhatsApp autenticado.

### Execucao somente leitura no proprio Windows

    powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts\windows\auditar-consolidacao-etapa49.ps1 -CodeDir . -Json

O resultado JSON informa doesNotApproveActivation=true intencionalmente.
Pode-se informar -OperationalDir, -LegacyDir e -BackupDir para verificar
outras pastas; em testes, use dados ficticios. Nunca copie a configuracao
ou o perfil real para uma checkout Git.

## Bloqueios que permanecem

### Integracao historica do GitHub

- PRs #38, #39, #40, #41, #42, #43, #44, #45 e #46 continuam em rascunho.
- PR #38 foi aberto sobre feat/convites-whatsapp-web-supervisionado, nao
  sobre main; a propria branch do legado esta mais de 50 commits a frente
  da main na auditoria local. Integrar #38 diretamente na branch-base
  nao promoveria o conjunto para main.
- Antes de qualquer merge, realizar revisao independente da diferenca
  entre main e a branch-base, conferir o historico de credenciais,
  integrar o trabalho-base de maneira aprovada e entao processar os
  PRs empilhados na ordem correta. Reexecutar CI apos rebase/retarget.
- Evitar squash ou rebase destrutivo de branches com dados locais;
  o GitHub deve manter apenas codigo, nunca arquivos de runtime.

### Privacidade do repositorio publico

O repositorio remoto estava PUBLICO em 27/10/2026. Esta etapa nao alterou
visibilidade nem apagou historico, pois isso pode afetar colaboradores e
integracoes e requer aprovacao do proprietario. Recomendacoes:

- Avaliar converter o repositorio em privado nas configuracoes do GitHub.
- Auditar os conteudos dos commits historicos e de todas as branches
  acessiveis; a inspeccao de nomes de arquivos feita aqui e preliminar.
- Se algum segredo real tiver sido publicado, revogar/rotacionar
  esse segredo. Apenas tornar privado nao desfaz exposicao anterior.

### Rollback e credenciais

Os backups locais sao pre-requisito, mas so um teste completo de
restauracao em isolamento pode aprovar recuperacao. Tokens OAuth do Meli
podem ser rotativos, portanto snapshots anteriores a renovacao podem
conter refresh tokens invalidos. Nao restaurar ou renovar credenciais
sem reconciliar ambas instalacoes e sem preservar as tentativas WhatsApp
incertas.

### Operacao real e ativacao

- Nao ativar monitores ou autoenvio durante a consolidacao.
- Nao instalar PostgreSQL, API oficial paga de WhatsApp ou sincronizar
  contatos/sessoes para Google Drive ou GitHub.
- Nao mover C:\projeto01, C:\afiliados-v2-homologacao ou
  C:\BackupsAfiliados enquanto os processos estiverem em uso.
- Revisar com usuario presente a sessao WhatsApp, OAuth Meli, link
  de afiliado e estado das filas ANTES de testes reais.
- Inicializacao automatica do Windows fica para a etapa futura de
  estabilizacao, conforme decisao do proprietario.

## Evidencias de validacao na copia isolada (27/10/2026)

- Suite de auditoria: 4/4 testes aprovados (segredo sintetico,
  flags fail-closed, modo read-only e protecao de arquivos Git).
- Primeiro ciclo RED registrado: a nova suite detectou que
  .env.production ainda nao era ignorado; apos proteger .gitignore,
  a mesma suite passou integralmente.
- TypeScript: npm.cmd run typecheck com saida 0.
- Regressao pura de agendamento, Amazon, OAuth Meli e scripts permitidos:
  9/9 testes aprovados, sem abrir navegador ou acessar APIs reais.
- npm.cmd audit --audit-level=high: 0 vulnerabilidades.
- git diff --check: aprovado apos eliminar linhas extras.
- Arquivos de runtime da homologacao nao receberam patches; nenhuma
  porta, sessao, contato, historico ou fila foi alterada.

## Atualizacao: nomes neutros das pastas no ACER (27/10/2026)

Foi autorizada a permanencia da automacao no ACER, com pastas principais sem
nomes comerciais ou descritivos do projeto:

- C:\projeto01: copia antiga preservada, sem alteracoes.
- C:\projeto02: instalacao de ofertas, Shopee e Captacao em uso (3030/3040).
- C:\projeto03: backups locais, inclusive backup da mudanca de caminhos.
- %LOCALAPPDATA%\Projeto04: desenvolvimento, Git e relatorios com ACL restrita.
- C:\projeto05: proxima pasta opcional de homologacao, nao criada.

A migracao da instalacao ativa foi feita apos validar estado pausado,
desligar apenas os dois servidores locais e renomear a pasta no mesmo
volume. Os hashes de configuracao, historico e perfil verificados nao
mudaram. Os dois servidores foram reiniciados a partir de C:\projeto02,
com monitores e autoenvio desligados, portas limitadas a loopback e
todas as paginas basicas HTTP 200.

O repositorio de desenvolvimento foi movido para o perfil local neutro.
Sete worktrees vinculadas foram verificadas e reparadas com o comando
oficial do Git. Nomes tecnicos internos aos fontes foram preservados
para nao quebrar importacoes ou o historico Git.

O diretório de backups foi renomeado sem copiar o conteudo; contagem de
2.965 arquivos, tamanho total e hash de amostra foram conferidos. Os
snapshots originais nao foram alterados. Scripts de rollback historicos
podem mencionar os caminhos antigos; confirmar a localizacao real dos
backups em C:\projeto03 antes de restaurar.

Quatro arquivos operacionais com referencias antigas ou a instalacao
legada foram ajustados para caminhos portateis/neutros, depois de criar
copia integra com SHA256 em C:\projeto03\2026-10-27_renomeacao:
- scripts/windows/preparar-homologacao.ps1 (C:\projeto05 e bloqueio dos
  caminhos operacionais; ZIP temporario com prefixo neutro)
- src/painel/public/index.html (pasta atual da extensao local Meli)
- captacao/caca-promos-vip/scripts/reiniciar-whatsapp-seguro.ps1
  (WorkingDirectory a partir do proprio script)
- captacao/caca-promos-vip/scripts/ativar-recusa-netlify.ps1
  (caminho de dados relativo ao modulo)

Nao foram excluidas sessoes do Chrome, contatos, logs ou historico de
WhatsApp. Nenhum envio real foi efetuado. A mudanca nao aprova a
ativacao automatica ou a migracao do GitHub para a branch principal.

## Criterios de passagem para Etapa 50

- [x] Inventario da instalacao e portas no ACER.
- [x] ACL local e ocultacao de pastas verificadas.
- [x] Comparacao de 119 arquivos operacionais sem diferencas de conteudo.
- [x] Clone separado sem dados reais e protecao de permissoes.
- [x] Auditor read-only, testes de segredos sinteticos e CI preparados.
- [ ] Revisao independente e integracao segura dos PRs base.
- [ ] Decisao do proprietario sobre tornar o GitHub privado.
- [ ] Auditoria profunda do historico de segredos e restauracao completa.
- [ ] Homologacao funcional real da Etapa 50.

A Etapa 49 pode encerrar a implementacao do kit de consolidacao sem
alegar que os quatro bloqueios acima estejam resolvidos.


## Atualizacao final - retirada do projeto antigo do C: (27/10/2026)

Por solicitacao do proprietario, a instalacao antiga C:\projeto01 foi
confirmada como parte deste repositorio (Git remoto e commit iguais ao
upstream) e foi eliminada. Seu codigo versionado ja esta no GitHub.

Auditoria de preservacao anterior a retirada:
- Dados do robo antigo: 2.834 de 2.834 arquivos identicos ao backup
  por SHA-256, incluindo o perfil antigo do navegador.
- Dados da Captacao antiga: 114 de 114 arquivos identicos ao backup por
  SHA-256, sem expor contatos ou chaves na auditoria.
- Tres arquivos experimentais nao versionados foram arquivados e
  verificados por SHA-256; nao foram ativados.
- O .env antigo tinha as mesmas 40 chaves do atual, mas a chave de
  autoenvio WhatsApp divergia; a instalacao ATUAL conserva autoenvio
  desligado. Credenciais nao foram exibidas ou sincronizadas.
- Nao havia scripts, processos Node ou tarefas agendadas dependentes
  da antiga pasta. Nenhum link simbolico/junction sob sua raiz.

A antiga instalacao foi movida para uma pasta temporaria de isolamento.
Os paineis em 3030 e 3040 continuaram respondendo HTTP 200. So entao
a copia antiga de 88.646 arquivos (5.593.829.969 bytes) foi apagada.
A limpeza concluiu com codigo zero e a pasta de isolamento deixou de existir.

Os backups foram mantidos e movidos sem copiar bytes novamente do
diretorio C:\projeto03 para %LOCALAPPDATA%\Projeto04\reserva, uma area
oculta com ACL restrita a conta local, Administradores e SYSTEM.
Contagem, tamanho e hashes amostrais foram verificados antes e depois.
A raiz do C: ficou somente com C:\projeto02 como diretorio principal
do projeto. A area oculta Projeto04 ainda mantem os codigos de
desenvolvimento e backups; nao e uma segunda instalacao ativa.

**Pendencia especifica do Chrome:** um perfil do Chrome continha
registrada a extensao local Mercado Livre com caminho antigo
C:\projeto01\browser-extension\mercadolivre-affiliate. O mesmo codigo
da extensao ja existe em
C:\projeto02\browser-extension\mercadolivre-affiliate.
Nao foram editadas as Secure Preferences do Chrome durante a limpeza
nem aberto navegador de automacao. Se a extensao deixar de funcionar,
recarregar/reinstalar a versao descompactada apontando para o novo
caminho, sem mudar dados ou API.

Os scripts historicos de rollback nos backups podem conter caminhos
anteriores, portanto o endereco atual dos backups deve ser utilizado.
O auditor da Etapa 49 ainda exige a presenca do caminho legado para
marcar localAclRestricted=true; com a instalacao velha removida,
esse indicador vira falso mesmo que as ACLs das pastas remanescentes
estejam restritas. Interpretar paths.legacy.exists=false e verificar
individualmente installed/backup/configuration/whatsappProfile, sem
considerar a remocao um erro de seguranca.

Nenhuma automacao foi ligada, nenhum WhatsApp foi enviado, nenhum
PostgreSQL foi instalado. O PR continua draft sem merge.
