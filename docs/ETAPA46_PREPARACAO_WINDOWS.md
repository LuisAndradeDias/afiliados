# Afiliados 2.0 — Etapa 4.6: preparacao de Windows com instalacao isolada

Data: 2026-10-26. Base: PR #43 (seguranca). Status: preparacao testada em ACER; **nao instalada no PC novo**.

## Diagnostico do computador conectado

Remote Desktop Commander conta 14: apenas **ACER** online, antigo Aspire E5-574. Conta 13: Luis, ACER e Andrade offline. Sem indicacao confiavel de qual deles e o computador novo. Nenhuma instalacao de producao pode ser feita ate reconectar e identificar o PC certo.

A instalacao original em C:\projeto01 permanece intocada, com arquivos pessoais e perfis existentes. Sem PostgreSQL, sem Google Drive, sem Cloud API WhatsApp, sem envios.

## Kit criado

- Abrir Painel.bat: remove o caminho legado C:\PromocoesAfiliados; usa a pasta em que esta salvo (%~dp0). O comando --verificar valida a estrutura sem abrir Chrome, iniciar Node ou enviar mensagens.
- scripts/windows/preflight-afiliados.ps1: diagnostico **somente leitura** de Node >=24, npm.cmd, Git, Chrome instalado, espaco na unidade C: e portas locais 3030/3040/3045. Emite JSON sem consultar credenciais, contatos ou tokens.
- scripts/windows/preparar-homologacao.ps1: por padrao apenas dry-run. Com -Execute, gera copia nova usando exclusivamente git archive HEAD da pasta limpa de codigo. Nao copia .env, data, dados, perfis ou node_modules. Rejeita pasta existente, UNC, outra unidade e caminhos protegidos.
- tests/instalacao-windows.test.mjs: verifica inicializador, preflight, dry-run, copia sem dados e recusa de sobrescrita.
- .github/workflows/instalacao-windows-etapa46.yml: CI em Windows sem WhatsApp ou OAuth reais.

## Comandos quando a maquina NOVA estiver conectada

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

- Backup de configuracoes e dados reais: somente apos confirmar o PC novo, em pasta protegida no C:, com verificacao de integridade e de restauracao; nunca incluir em GitHub ou Drive.
- Sessao do WhatsApp e extensão Mercado Livre: configurar e homologar com o usuario presente. O clone de codigo nao transfere uma sessao.
- Portal localhost:3030, Central /central, Ofertas /ofertas; Captação/Campanhas localhost:3040 ou 3045 conforme o entrypoint. Nao iniciar processos duplicados ao migrar.
- Antes de qualquer rollback, parar somente processos pertencentes a pasta da nova versao, preservar dados/filas e executar o inicializador da instalacao anterior. Nao apagar tentativa incerta nem historico.
- A base do PR #38 tem 58 commits alem de main; a cadeia de PRs #38→#43 continua draft. PR desta etapa fica tambem em draft, sem merge.
- Revisao independente, PC novo online e homologacao de Mercado Livre/WhatsApp real continuam pendentes.

## Critérios de aceite da preparacao

- Testes RED observados antes de implementar, GREEN em Windows isolado depois.
- Sem arquivos pessoais no pacote Git.
- Sem instalacao sobre C:\projeto01, sem alteracao de .env ou data.
- CI do Windows aprovada antes da revisao.
- **Isso nao constitui aprovacao para producao.**
