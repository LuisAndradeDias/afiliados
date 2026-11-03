# Central de Ofertas Cockpit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganizar a Central de Ofertas com status operacional, terminal lateral e Configurações em drawer preservando todas as funções.
**Architecture:** HTML conserva elementos de operação e IDs. Script CSS/JS isolado monta a grade e move nós originais sem cloná-los. O refresh atual entrega `/api/status` ao novo renderizador.
**Tech Stack:** HTML, CSS, JavaScript, Node TypeScript, Playwright Chrome.
**Spec:** `docs/superpowers/specs/2026-11-03-central-ofertas-cockpit-design.md`

## Global Constraints
- Não alterar APIs, processos do WhatsApp, regras de canal ou autoenvio.
- Textos em português; tema navy/verde; zero métricas fictícias.
- Acessibilidade de teclado e responsividade.

## Review Focus
- Logs vazios e indisponibilidade temporária da API não podem sugerir progresso falso.
- Repetição de atualizações não pode roubar foco dos formulários.
- Drawer deve preservar ações originais sem duplicação de IDs/eventos.
- Filtros de console devem lidar com texto inesperado sem injeção de HTML.
- Canais não homologados nunca devem aparecer como aptos a publicar.

### Task 1 — Teste de comportamento (RED)
**Files:** Create `tests/painel-cockpit.mts`
- [ ] Testar estado do topo, console, filtros, pausa e histórico; falhar com ausência do novo cockpit.
- [ ] Testar drawer, tabs, Escape, foco e todos os controles originais.
- [ ] Testar layout mobile e ausência de POSTs involuntários.

### Task 2 — Arquivos isolados (GREEN)
**Files:** Create `src/painel/public/ofertas-cockpit.css`, `ofertas-cockpit.js`; modify `src/painel/public/index.html`, `src/painel/rotas-visuais.ts`
- [ ] Registrar CSS e JS no roteador de assets.
- [ ] Criar topo operacional e grade lateral por movimentação de DOM.
- [ ] Criar drawer com tabs; mover elementos originais, sem novas permissões.
- [ ] Renderizar log filtrado, histórico recente, alertas e status.
- [ ] Integrar callback ao refresh atual, sem polling duplicado.
- [ ] Fazer os testes RED passarem.

### Task 3 — Regressões e implantação
- [ ] Rodar `npm run typecheck` e testes Playwright existentes.
- [ ] Verificar e comparar screenshots desktop/mobile.
- [ ] Versionar branch de desenvolvimento.
- [ ] Implantar só assets aprovados com backup se a base operacional corresponder, sem reiniciar automações.
