# Etapa 4.5 — Segurança de dependências Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Eliminar a dependência Zod vulnerável e não utilizada, com comprovação TDD, audit e regressão completa em ambiente isolado.

**Architecture:** Remover apenas declaração de dependência e lockfile usando npm oficial; criar contrato de segurança para impedir importação acidental e CI com auditoria de produção. Manter os servidores intactos.

**Tech Stack:** Node.js 24, npm.cmd 11, TypeScript NodeNext, `node:test`, GitHub Actions no Ubuntu.

**Spec:** `docs/superpowers/specs/2026-10-26-etapa45-seguranca-design.md`

## Global Constraints

- Não tocar `C:\projeto01`, Chrome, credenciais, `.env`, contatos, filas, campanhas ou produção.
- Trabalhar em worktree isolado no C: e PR draft sobre #42; sem merges.
- Confirmar no Git rastreado que Zod não está importado por aplicação/robôs.
- Testes reais só com mocks, dados temporários e sem mensagens/envios.
- Não instalar PostgreSQL e não executar `npm audit fix --force`.

## Review Focus

- Qualquer import direto de `zod` após a remoção → falha com arquivo/linha.
- Zod persistir como dependência direta do root `package.json` ou `package-lock.json` → falha.
- npm audit identificar qualquer HIGH/CRITICAL em dependências de produção → pipeline falha.
- Erro TypeScript ou regressão das filas/WhatsApp após alteração do lockfile → sem merge.
- PR chain #38→#42 fora de ordem ou sem revisão independente → sem implantação.

---

### Task 1: Worktree, contrato e RED

**Files:** criar `tests/dependencias-seguranca.mts`; preservar arquivo inicial de package.

- [x] Criar worktree isolado no C: partindo do PR #42 e verificar ausência de dados e `.env`.
- [x] Escrever teste com `node:test` que falha se `zod` existir nas dependências diretas do package/lock.
- [x] Incluir teste que inspeciona arquivos versionados da aplicação por specifier `zod` sem abrir assets grandes de OCR.
- [x] Rodar `node --import tsx --test tests/dependencias-seguranca.mts`; esperado RED na dependência declarada.

### Task 2: Correção mínima e GREEN

**Files:** editar somente `package.json` e `package-lock.json` por `npm.cmd uninstall zod --ignore-scripts --no-audit --no-fund`.

- [x] Remover Zod da cópia isolada e atualizar lock.
- [x] Reexecutar o teste; esperado GREEN.
- [x] Rodar `npm.cmd ls zod --all`, `npm.cmd audit --omit=dev --audit-level=high`; esperado nenhum pacote Zod direto e 0 HIGH/CRITICAL.
- [x] Rodar `npm.cmd ci --ignore-scripts --no-audit --no-fund` para provar instalação reprodutível; `npm.cmd run typecheck`.

### Task 3: Regressão e CI

**Files:** criar `.github/workflows/seguranca-etapa45.yml`.

- [x] CI exclusiva para a branch: teste de dependências, `npm audit --omit=dev --audit-level=high`, typecheck, Ofertas, Central, Meli mock, Captação, consentimento e worker Chrome mock.
- [x] Regressão Windows com `node --test` e `node --import tsx`, sem enviar mensagens.
- [x] Registrar resultados, hashes e comandos sem dados privados em `docs/ETAPA45_SEGURANCA.md`.

### Task 4: Revisão e PR

**Files:** `docs/superpowers/progress/2026-10-26-etapa45-seguranca.md`.

- [x] Inspecionar diff e todos os cinco PRs empilhados, certificando que nada mudou em produção.
- [x] Abrir PR draft de branch `fix/seguranca-zod-etapa45` para `chore/homologacao-windows-etapa44`.
- [x] Verificar GitHub Actions verde, auditar status dos PRs e documentar pendências de revisão independente e máquina nova.

## Bloqueios de produção (não fazem parte dos testes concluídos)

- [ ] Revisão independente, externa ao implementador, dos PRs #38–#43.
- [ ] Aprovação de integração da base `feat/convites-whatsapp-web-supervisionado` em `main` (58 commits/194 arquivos além de main).
- [ ] Backup e validação das sessões/dados no Windows novo (não no ACER antigo).
- [ ] Homologação manual das integrações reais Meli e WhatsApp antes do deploy.
