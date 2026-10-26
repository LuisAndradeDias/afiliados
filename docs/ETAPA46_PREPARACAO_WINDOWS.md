# Afiliados 2.0 — Etapa 4.6: preparacao de Windows com instalacao isolada

Data: 2026-10-26. Base: PR #43 (seguranca). Status: homologação isolada instalada no ACER (destino definitivo confirmado), sem ativar robôs.

## Diagnostico do computador conectado

O responsável confirmou que **o próprio ACER é a máquina definitiva** e que não existe computador novo. O dispositivo ACER está online na conta 14. A instalação de produção continua condicionada à revisão e à validação das sessões, não à conexão de outra máquina.

A instalacao original em C:\projeto01 permanece intocada, com arquivos pessoais e perfis existentes. Sem PostgreSQL, sem Google Drive, sem Cloud API WhatsApp, sem envios.

## Kit criado

- Abrir Painel.bat: remove o caminho legado C:\PromocoesAfiliados; usa a pasta em que esta salvo (%~dp0). O comando --verificar valida a estrutura sem abrir Chrome, iniciar Node ou enviar mensagens.
- scripts/windows/preflight-afiliados.ps1: diagnostico **somente leitura** de Node >=24, npm.cmd, Git, Chrome instalado, espaco na unidade C: e portas locais 3030/3040/3045. Emite JSON sem consultar credenciais, contatos ou tokens.
- scripts/windows/preparar-homologacao.ps1: por padrao apenas dry-run. Com -Execute, gera copia nova usando exclusivamente git archive HEAD da pasta limpa de codigo. Nao copia .env, data, dados, perfis ou node_modules. Rejeita pasta existente, UNC, outra unidade e caminhos protegidos.
- tests/instalacao-windows.test.mjs: verifica inicializador, preflight, dry-run, copia sem dados e recusa de sobrescrita.
- .github/workflows/instalacao-windows-etapa46.yml: CI em Windows sem WhatsApp ou OAuth reais.

## Comandos no ACER, se for necessário preparar outra cópia

Executar no Windows, em pasta **de codigo Git** da branch aprovada. As politicas do PowerShell do usuario nao devem ser alteradas globalmente.

### 1. Diagnostico somente leitura

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\windows\preflight-afiliados.ps1 -Json

O comando exibe apenas ferramentas, portas e espaco livre. Para recusar ambiente sem Node 24+, npm.cmd, Git ou espaco, adicionar -Strict.

### 2. Simulacao do preparo, sem criar pasta

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\windows\preparar-homologacao.ps1 -DestinationDir "C:\afiliados-v2-homologacao"

### 3. Preparacao em pasta NOVA e isolada (requer aprovacao de deploy)

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\windows\preparar-homologacao.ps1 -DestinationDir "C:\afiliados-v2-homologacao" -Execute -InstallDependencies

Este passo cria uma copia dos arquivos Git e roda npm.cmd ci --ignore-scripts. Nao abre painel, nao instala PostgreSQL e nao inicia monitor ou WhatsApp. **Se a pasta de destino ja existir, o script aborta sem alterar nada.** Nao execute novamente -Execute na mesma pasta; nunca copie configuracoes reais automaticamente.

### 4. Teste do inicializador sem executar o painel

    cmd.exe /d /c "Abrir Painel.bat --verificar"

Para uso real, o launcher normal deve ser aberto somente apos a validacao e a autorizacao da implantacao.

## Regras de privacidade, reversao e integracao

- Backup local já criado em C:\\BackupsAfiliados\\2026-10-26_antes-afiliados-v2, com ACL restrita, contagem e tamanho conferidos (2.948 arquivos) e hash SHA-256 da configuração verificado. Não enviar dados ao GitHub ou Drive. A validação de uma restauração completa em operação ainda é pendente.
- Sessão WhatsApp e perfil Mercado Livre: uma cópia local dos perfis e da configuração já foi restaurada na homologação; isso não comprova login válido. Revalidar com o usuário presente, sem envios automáticos.
- Portal localhost:3030, Central /central, Ofertas /ofertas; Captação/Campanhas localhost:3040 ou 3045 conforme o entrypoint. Nao iniciar processos duplicados ao migrar.
- Antes de qualquer rollback, parar somente processos pertencentes a pasta da nova versao, preservar dados/filas e executar o inicializador da instalacao anterior. Nao apagar tentativa incerta nem historico.
- A base do PR #38 tem 58 commits alem de main; a cadeia de PRs #38→#43 continua draft. PR desta etapa fica tambem em draft, sem merge.
- Revisão independente, homologação de Mercado Livre/WhatsApp real e aprovação da ativação no ACER continuam pendentes.

## Critérios de aceite da preparacao

- Testes RED observados antes de implementar, GREEN em Windows isolado depois.
- Sem arquivos pessoais no pacote Git.
- Sem instalacao sobre C:\projeto01, sem alteracao de .env ou data.
- CI do Windows aprovada antes da revisao.
- **Isso nao constitui aprovacao para producao.**

## Atualização operacional — ACER confirmado (26/10/2026)

- Fonte de código: `C:\\afiliados-v2-fonte`, branch `chore/instalacao-segura-windows-etapa46`, commit `c329253e17d71b1d3aa523ad0e94d73776f4c4b8`.
- Homologação: `C:\\afiliados-v2-homologacao`. npm ci, TypeScript e npm audit (0 vulnerabilidades) concluídos no Windows.
- Backup: `C:\\BackupsAfiliados\\2026-10-26_antes-afiliados-v2`, ACL restrita; nenhum arquivo privado publicado no Git.
- Configuração, contato/histórico e perfis foram copiados localmente à homologação, **sem modificar** `C:\\projeto01`.
- Flags na instalação nova: `ALTERNATING_MONITOR_ENABLED=false`, `MERCADOLIVRE_MONITOR_ENABLED=false` e `WHATSAPP_AUTO_SEND_ENABLED=false`. Grupo previamente salvo foi preservado, sem exibir ou repetir seu nome.
- Ofertas/Central e Captação/Campanhas verificadas via HTTP 200 com dados restaurados; bloqueio cross-site 403; processos de teste encerrados.
- O vencimento registrado para o access token Mercado Livre já ocorreu; refresh token existe, mas **não foi renovado nesta etapa** para evitar invalidar o rollback. Login real do WhatsApp ainda não foi testado.
- Relatório sem segredos disponível em `C:\\afiliados-v2-homologacao\\diagnosticos-local\\REGISTRO_MIGRACAO_ACER.txt`.
- O corte definitivo e a ativação de automações **não** aconteceram. Nenhum serviço permanente ficou escutando 3030/3040/3045.
