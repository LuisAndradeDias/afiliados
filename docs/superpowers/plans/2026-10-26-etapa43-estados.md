# Etapa 4.3 — Temporizadores e filas supervisionadas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extrair decisões de agendamento e transições de filas WhatsApp preservando todos os comportamentos seguros existentes.

**Architecture:** Funções puras testadas + timer com token de geração; servidores existentes mantêm autorização, persistência, estado mutável e envio manual.

**Tech Stack:** TypeScript NodeNext, ESM .mjs, Node.js 24, node:test, tsx, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-26-etapa43-estados-design.md`

## Global Constraints
- Sem envio real, OAuth real, banco novo ou worker de produção.
- Sem atualização de `C:\projeto01`, `.env`, cookies, dados, filas ou contato de terceiros.
- Sem relaxar limites de 50/dia, um WhatsApp de cada vez, validação opt-in, descadastro, eventos incertos ou bloqueios.
- PR draft sobre PR #40, nenhuma publicação/merge.
- Nenhuma alteração visual necessária neste ciclo.

## Review Focus
- Timer cancelado pelo operador pode ter callback já na fila; deve ser ignorada.
- Timer reagendado não pode disparar duas plataformas.
- Tentativa reservada (`incerto`) não pode ser reenviada silenciosamente após falha/restart.
- Recusa ou nova autorização não pode remover histórico de envio e liberar uma fila antiga.
- CONFIRMADO sem evento ENVIANDO só vira enviado após evidência do worker e reserva persistida.

---

### Task 1: Agendador de ofertas

**Files:** Create `tests/monitor-agendamento.mts`, `src/painel/dominios/monitor-agendamento.ts`; modify `src/painel/server.ts`.

**Interfaces:** `calcularAtrasoMonitor({ agoraEm, atrasoSolicitadoMs, proximaLiberacaoEm }): { esperaRestanteMs, atrasoMs, proximaBuscaEm }`; `criarTemporizadorExclusivo<T>({ agendar, cancelar }): { armar(callback, atraso), desarmar(), temPendente() }`.

- [ ] Escrever teste RED: limites 500ms, atraso solicitado, intervalo histórico, timer cancelado, timer substituído, callback antiga executada à força, callback correta apenas uma vez.
- [ ] Rodar `npx tsx --test tests/monitor-agendamento.mts`; esperado FAIL módulo ausente.
- [ ] Criar domínio do agendamento e trocar somente cálculo/controle do timer em `server.ts`.
- [ ] Rodar teste novo, `npx tsx tests/intervalos-envio.mts`, `npm run typecheck`; esperado PASS.
- [ ] Inspecionar diff do servidor: nenhuma alteração em ações de enviar/descartar/grupo.

### Task 2: Fila supervisionada — máquina de estados

**Files:** Create `captacao/caca-promos-vip/tests/estados-tentativa.test.mjs`, `captacao/caca-promos-vip/src/estados/tentativa-web.mjs`; modify `captacao/caca-promos-vip/src/convites-unicos.mjs`.

**Interfaces:** `proximoStatusTentativaWeb(status, evento, { invalidada=false }): string`.

- [ ] Testar RED: reservar aberto→incerto, reserva idempotente incerto, confirmar incerto→enviado, rejeitar confirmação fora de incerto, conciliar enviado ou não enviado com confirmação no chamador, invalidada→ignorado.
- [ ] Rodar `node --test captacao/caca-promos-vip/tests/estados-tentativa.test.mjs`; esperado FAIL antes do módulo.
- [ ] Implementar helper e ligar às funções `marcarTentativaIncerta`, `confirmarTentativaWorker`, `conciliarTentativa` sem mudar mensagens/arquivos/limites.
- [ ] Rodar testes e regressão `node --test captacao/caca-promos-vip/tests/convites-web-manual.test.mjs captacao/caca-promos-vip/tests/whatsapp-incerto.test.mjs`; esperado PASS.

### Task 3: Estado de worker e regressão supervisionada

**Files:** Create `captacao/caca-promos-vip/tests/estados-worker.test.mjs`, `captacao/caca-promos-vip/src/estados/whatsapp-worker.mjs`; modify `captacao/caca-promos-vip/src/whatsapp-convite-controller.mjs`.

**Interfaces:** `classificarFalhaWorker({tentouEnviar,jaPreparou}): 'incerto'|'erro'`; `faseOcupadaWhatsapp(fase, processoAtivo): boolean`; `podeCancelarWhatsapp(fase):boolean`.

- [ ] Testar RED classificação de falhas pós-clique/pós-pronto, ocupação com processo ativo e cancelamento antes do clique.
- [ ] Rodar `node --test captacao/caca-promos-vip/tests/estados-worker.test.mjs`; esperado FAIL.
- [ ] Implementar helper, integrar avaliação de `ocupado`, `ERRO`, `exit/error` e `cancelar`; não alterar funções `enviar`, `CONFIRMADO`, `marcarTentativaIncerta`.
- [ ] Rodar testes e worker simulado `node --test captacao/caca-promos-vip/tests/whatsapp-worker-supervisionado.test.mjs`; esperado PASS.

### Task 4: CI, auditoria e PR

**Files:** Create `.github/workflows/refactor-etapa43.yml`, `docs/ETAPA43_ESTADOS_E_FILAS.md`, atualizar plano e ledger no GitHub.

- [ ] CI roda TDD novos, typecheck, regressão consentimentos, intervalos, consultas, worker e Chrome de simulação (sem redes/WhatsApp real).
- [ ] Capturar logs da execução final; registrar advertências de dependência (`npm audit`) sem `npm audit fix --force`.
- [ ] Revisar diff da branch contra #40; corrigir problemas reais, documentar risco residual.
- [ ] Abrir PR draft contra `refactor/dominios-v2-etapa42`, sem mesclar ou publicar.
