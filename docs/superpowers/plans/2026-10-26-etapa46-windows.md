# Etapa 4.6 — Windows Staging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Construir preparacao portatil de instalacao Windows sem dados privados e sem tocar nos robos ate o novo computador estar online.

**Architecture:** Preflight read-only PowerShell + bootstrap de `git archive` com dry-run obrigatorio por padrao + launcher portatil usando o inicializador do projeto. Testes Node executam PowerShell/Batch em Windows e CI dedicada.

**Tech Stack:** Windows 10/11, PowerShell 5.1+, Node 24, npm.cmd, Git, GitHub Actions windows-latest.

**Spec:** `docs/superpowers/specs/2026-10-26-etapa46-windows-design.md`

## Global constraints

- A conta 14 no Remote Desktop Commander tem ACER antigo online, nao Windows novo.
- Nenhuma alteracao em `C:\projeto01`, dados, perfis, Chrome, credenciais, PostgreSQL ou campanhas reais.
- PR #43 e demais PRs draft nao mesclados, preparar PR #44 sobre #43.
- Sem backup real de credenciais antes de confirmar PC de destino, sessao e protecao.

### Task 1 — Setup e testes RED

**Files:** criar `tests/instalacao-windows.test.mjs`.

- [x] Criar worktree isolada C: a partir de `chore/instalacao-segura-windows-etapa46`; sem `.env` nem `data/`.
- [x] Escrever teste de caminho relativo e modo `--verificar` no `Abrir Painel.bat`; teste nao deve executar launcher original enquanto o guard nao existir.
- [x] Escrever teste preflight JSON seguro e preflight sem modificar repo.
- [x] Escrever testes dry-run de staging, execucao explicita em pasta temporaria, ausencia `.env/data/dados/.git/node_modules`, recusa de sobrescrita.
- [x] Executar e observar RED correto (modulos nao existem, launcher hardcoded).

### Task 2 — Launcher e preflight

**Files:** modificar `Abrir Painel.bat`; criar `scripts/windows/preflight-afiliados.ps1`.

- [x] Implementar verificacao sem efeitos, caminho relativo e fallback do launcher existente, sem abrir Chrome durante `--verificar`.
- [x] Preflight identifica Node >=24, npm.cmd, Git, arquivos root, espaco livre C: e ocupacao de portas 3030/3040/3045 em modo read-only.
- [x] Rodar testes Windows, observar progresso RED→GREEN.

### Task 3 — Staging seguro

**Files:** criar `scripts/windows/preparar-homologacao.ps1`.

- [x] Bloquear destino existente, UNC, outra unidade que nao C:, caminho em projeto atual, e destinos que nao contenham homologacao/staging.
- [x] Validar checkout limpo e ausência de dados privados versionados, fonte git raiz; exigir `-Execute` para criar copia.
- [x] Exportar `git archive HEAD` para ZIP temporario em C:, expandir em destino vazio; remover ZIP temporario; verificar ausencia de dados/segredos.
- [x] Somente mediante `-Execute -InstallDependencies` executar `npm.cmd ci --ignore-scripts` com `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`.
- [x] Verificar testes com diretorio temporario, sem rodar qualquer painel.

### Task 4 — CI, documentacao, PR

**Files:** criar `.github/workflows/instalacao-windows-etapa46.yml`, `docs/ETAPA46_PREPARACAO_WINDOWS.md`, ledger.

- [x] CI Windows testes de launcher/preflight/staging; CI de seguranca anterior permanece na heranca PR #43.
- [x] Auditar diff e comandos para evitar dados, token ou envio involuntario; conferir testes e ausencia de new .env.
- [x] Criar PR draft sobre `fix/seguranca-zod-etapa45` sem merge.
- [x] Documentar pending: conectar computador novo, backup local seguro, homologar WhatsApp e Meli, revisao independente e integrar base main.

## Bloqueios de implantação (nao resolvidos pela Etapa 4.6)

- [x] ACER confirmado pelo responsável como computador definitivo e conectado à conta 14 do Remote Desktop Commander.
- [ ] Revisao independente dos PRs #38-#44 e integracao cuidadosa da base +58 commits com main.
- [x] Backup protegido no C: do ACER, verificado por contagem/tamanho e SHA-256 de configuração; dados duplicados apenas em homologação. Teste completo de restauração operacional ainda pendente.
- [ ] Homologar sessão real WhatsApp e OAuth Mercado Livre no ACER sem envios de teste; access token está expirado e o refresh não foi acionado.
- [ ] Autorizacao explicita para publicar e trocar a instalacao em uso.
