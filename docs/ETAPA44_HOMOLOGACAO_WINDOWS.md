# Afiliados 2.0 — Etapa 4.4: homologação isolada Windows (2026-10-26)

## Ambiente inspecionado e decisão
- Equipamento alcançável via Desktop Commander: **ACER Aspire E5-574**, Windows 10 Pro 64-bit, 16 GB RAM; **não foi identificado como o PC novo de produção**.
- Repositório legado: `C:\projeto01`, branch `feat/convites-whatsapp-web-supervisionado`, commit `ce707cc`.
- Dados locais preexistentes fora do Git em `data/` e `captacao/caca-promos-vip/extensao-lateral/experimentos/`; **não tocar**.
- Portas 3030, 3040 e 3045 não estavam em LISTEN no momento do diagnóstico.
- Node v24.19.0, npm.cmd 11.17.0, Git 2.56.0. PowerShell bloqueia `npm.ps1` por ExecutionPolicy; usar **`npm.cmd`** em vez de alterar a política global.
- Disco C: aproximadamente 294 GB livres no diagnóstico.

## Isolamento e instalação
- Clone de apenas uma branch, sem baixar dados, em `C:\afiliados-homologacao-v2`.
- Branch testada: `refactor/estados-filase-timers-v2-etapa43`, commit `39514bb4bb5c346635f0392f9b77150e5420c28b`.
- Confirmado na cópia: **sem `.env`, sem `data/`, sem `node_modules` antes da instalação**.
- Dependências instaladas **somente na cópia** com `npm.cmd ci --ignore-scripts --no-audit --no-fund`, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`. Nenhum Chrome novo foi baixado.
- **Nenhum painel de produção ou worker WhatsApp/Meli foi aberto, nenhum dado real importado ou envio executado**.

## Resultados observados
- `npm.cmd run typecheck`: exit 0.
- `node --import tsx --test tests/monitor-agendamento.mts tests/painel-dominios.mts`: 9 testes, 9 passes, 0 falhas.
- `node --test captacao/caca-promos-vip/tests/{estados-tentativa,estados-worker,convites-web-manual,whatsapp-incerto,consentimento}.test.mjs` (executado com caminhos explícitos no Windows): **19 passes, 0 falhas**.
- Cenários exercitados: timers cancelados, OAuth Meli com fetch fictício, confirmação somente após reserva incerta, bloqueio de reenvio, reconciliação humana, limite diário 50, descadastro e opt-in, reinicialização simulada de estado da fila.
- Após os testes, `git status --porcelain` da cópia ficou sem alterações; o projeto original continuou com os mesmos dois diretórios não rastreados observados inicialmente.

## Auditoria de segurança (bloqueador antes de produção)
- `npm.cmd audit --omit=dev --json` reportou **1 vulnerabilidade HIGH e 0 CRITICAL** em dependências de produção.
- Pacote diretamente declarado: `zod` em `package.json` atualmente `^3.24.2`.
- Aviso: **Zod can exhaust memory while validating oversized constrained collections**; `npm audit` relata versões vulneráveis `<4.6.6`, correção indicada `zod@4.6.7` (`isSemVerMajor: true`).
- Não executar `npm audit fix --force` automaticamente. Para corrigir, criar PR específico com atualização controlada a Zod 4, adaptação de código compatível e testes de validação de cargas grandes/entradas adversárias; verificar demais dependências também.
- Enquanto não corrigido e revisado, **não publicar** a stack refatorada na máquina de produção.

## Rollback e recuperação
1. Não substituir `C:\projeto01`; instalar futura versão apenas em pasta paralela no computador definitivo, sem `.env`/dados pessoais copiados até aprovação da migração.
2. Para rollback de aplicação, parar **somente processos do ambiente homologado**, não os processos de outro projeto, e voltar a iniciar a instalação original pelo seu launcher habitual; nunca alterar arquivos de histórico para voltar a versão.
3. Preservar `.env`, perfis Chrome, `data/`, `dados/`, planilhas e históricos no local original. Backups devem ser **locais no C:**, criptografados/protegidos contra acesso indevido e verificados antes da implantação.
4. Rodar testes de recuperação simulada primeiro; nunca simular desligamento ou falha de disco sobre filas verdadeiras.
5. A cadeia de integração segura segue PRs **#38 → #39 → #40 → #41 → PR desta etapa**. Sem merges automáticos.

## Pendências explícitas
- [x] Diagnóstico read-only do ACER e identificação da versão antiga.
- [x] Clone e dependências em pasta de homologação isolada.
- [x] TypeScript, testes de domínios, temporizadores, consentimento, filas e incerteza.
- [x] Classificação inicial da vulnerabilidade HIGH em `zod`.
- [ ] Revisão independente do código de todas as etapas.
- [ ] Correção e testes de segurança de Zod em PR separado.
- [ ] Identificar e conectar o **Windows novo definitivo** ao Desktop Commander.
- [ ] Validar visual das telas, OAuth Meli e Chrome WhatsApp reais com usuário presente e **sem fazer envios reais de teste**.
- [ ] Fazer backup local, validar restauração e aprovar plano de migração antes do deploy.

**Limite desta entrega:** comprovação de testes isolados no ACER; não é homologação completa de integração real nem aprovação para produção.
