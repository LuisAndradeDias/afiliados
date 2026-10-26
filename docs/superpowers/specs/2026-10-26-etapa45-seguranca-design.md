# Afiliados 2.0 — Etapa 4.5: eliminar vulnerabilidade de dependência não utilizada

Data: 2026-10-26
Base: PR #42 (`chore/homologacao-windows-etapa44`).
Ambiente: worktree isolado no disco C: do ACER, com GitHub Actions e sem deploy.

## Diagnóstico e intenção

A auditoria de dependências em produção identificou 1 HIGH em Zod (`<4.6.6`) por consumo excessivo de memória durante validação de coleções grandes. A aplicação declara `zod: ^3.24.2` e instala 3.25.76. A inspeção dos arquivos rastreados com `git grep -I -l -i zod` não encontrou importações de `zod` em `src/`, `scripts/`, `tests/`, `captacao/` ou `browser-extension/`. As coincidências restantes aparecem somente em `package.json` e em bundles OCR/Tesseract de terceiros por ocorrência textual acidental; não são importações da biblioteca Zod.

Objetivo: remover Zod se os testes confirmarem ausência de uso, em vez de aplicar migração incompatível para Zod 4 sem finalidade funcional. Auditar depois, garantindo 0 vulnerabilidades HIGH/CRITICAL de produção. Não mudar funcionalidades, consentimento, WhatsApp/Meli, grupos, perfil Chrome, banco ou arquivos locais.

## Alternativas

1. Atualizar Zod 3→4.6.7: elimina a falha porém introduz mudança semântica major e mais superfície de regressão; **não escolher** se a dependência é não utilizada.
2. Remover a dependência direta e o lockfile correspondente via npm: **escolhida**, menor alteração e menor superfície de ataque. Exigir teste regressivo estático contra importação futura.
3. Ignorar a vulnerabilidade ou forçar `npm audit fix --force`: rejeitado.

## Restrições

- Toda escrita de código é exclusivamente no worktree C: isolado e branch `fix/seguranca-zod-etapa45`. `C:\projeto01` e `C:\afiliados-homologacao-v2` permanecem sem alterações.
- Não ler, exibir ou copiar `.env`, dados pessoais, tokens, Chrome profiles, filas reais ou contatos.
- Usar `npm.cmd` em Windows PowerShell sem alterar ExecutionPolicy; usar `--ignore-scripts` ao instalar dependências.
- Fazer TDD: teste de ausência de Zod deve falhar antes e passar após `npm uninstall`.
- CI deve verificar `npm audit --omit=dev --audit-level=high`, versão/lock, typecheck, contratos Mercado Livre, central, filas e consentimento com dados simulados. Não executar robôs reais.
- Nenhum PR será mesclado; criar draft empilhado após #42. Não instalar PostgreSQL, não implementar API WhatsApp paga.
- PRs #38–#42 recebem análise de status e dependências; revisão independente externa ainda é necessária.

## Riscos e rollback

- Se algum módulo/entrypoint realmente usar Zod, a suíte de testes ou a varredura estática deve expor antes do merge. Em caso de regressão reverter só a remoção no `package.json` e `package-lock.json`.
- O `npm audit` consulta registros externos e pode falhar por indisponibilidade da rede. Distinguir falha de rede de nova vulnerabilidade.
- Se o lock trouxer Zod transitivamente, o teste de ausência direta permanece válido, mas o audit precisa confirmar que não existe HIGH de produção.
- O teste no ACER não equivale à aprovação da instalação definitiva. Implantação requer identificação do PC novo e homologação com acesso supervisionado.
