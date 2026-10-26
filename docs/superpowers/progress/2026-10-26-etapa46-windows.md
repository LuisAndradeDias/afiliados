# SDD ledger — Etapa 4.6: preparacao isolada Windows

Plano: `docs/superpowers/plans/2026-10-26-etapa46-windows.md`.
Base: PR #43; nova branch: `chore/instalacao-segura-windows-etapa46`.
Ambiente: ACER antigo via Remote Desktop Commander (conta 14), worktree `C:\afiliados-etapa46-preparacao`. Dispositivos Luis/ACER/Andrade da conta 13 estavam offline.

## Task 1 — RED confirmado

Antes dos novos scripts, `node --test tests/instalacao-windows.test.mjs` falhou **4 de 4**:
1. `Abrir Painel.bat` tinha `cd /d C:\PromocoesAfiliados`;
2. `preflight-afiliados.ps1` ainda inexistente;
3. `preparar-homologacao.ps1` ainda inexistente;
4. impossibilidade de testar staging sem scripts.

## Task 2 — Launcher e preflight

- `Abrir Painel.bat` agora usa `%~dp0`, valida estrutura com `--verificar` sem processos e delega ao launcher .exe (se existente) ou ao `scripts/launcher/iniciar-painel.cmd`.
- `preflight-afiliados.ps1` checa ferramentas, disco, Chrome instalado e listeners de portas. Saida JSON sem credenciais e modo `-Strict` opcional.
- Teste focado RED adicional: quando Get-NetTCPConnection falhava para porta sem listener, preflight marcava `readyForActivation: true` com `checked: false`. Teste detectou inconsistencia. Corrigido consultando tabela completa e exigindo todas as portas efetivamente verificadas. Teste focado GREEN 1/1.
- Um erro do primeiro teste era da forma de citar caminho para `cmd.exe`, nao do launcher. Confirmado comando real `cmd /d /c 'call "...\Abrir Painel.bat" --verificar'` e ajustado o invocador Node para reproduzir a verificacao a partir de outro diretorio.

## Task 3 — Staging protegido

- `preparar-homologacao.ps1` nao cria arquivos por padrao; somente `-Execute` faz `git archive HEAD` de arquivos versionados, recusando `.env`, `data/`, `dados/` ou perfis rastreados, sobregravacao, UNC/outro drive, pastas operacionais e destino dentro da origem.
- `-Execute -InstallDependencies` roda npm.cmd ci com `--ignore-scripts` e `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`; nunca abre Chrome/servicos.
- No ACER, instalacao de teste em `C:\temp\afiliados-v2-homologacao-deps46`: `STAGING_CREATED`, `STAGING_DEPENDENCIES_READY`, typecheck exit 0; temporario removido com `TEST_STAGING_CLEANED`.
- O teste foi feito sobre o HEAD versionado local daquele momento (revisao `4b9be17`); depois, a GitHub Actions validou a branch atual com todos os scripts commitados.

## Task 4 — Qualidade e integracao

- Windows local: `node --test tests/instalacao-windows.test.mjs` **4/4**, zero falhas.
- npm.cmd ci, npm.cmd run typecheck, npm.cmd audit --audit-level=high (0 vulnerabilidades), git diff --check: aprovados.
- GitHub Actions Windows `40369792844`: **success** (Windows, npm audit, TypeScript, instalacao, seguranca Zod, Amazon/Meli mock, Central Unificada).
- Confirmado novamente: no computador original `C:\projeto01` nao foram alterados arquivos, contatos, chaves, `.env`, dados, perfis ou processos; nenhum WhatsApp real, OAuth real, PostgreSQL ou Drive.
- Commits em GitHub connector: arquivos de scripts, teste, workflow, documentação e launcher. Os PRs anteriores continuam em draft.

## Rulings e limites

- **Ruling:** nao tentar instalar no ACER como maquina definitiva, pois o dispositivo novo nao esta vinculado/online. Custo: homologacao operacional real adiada.
- **Ruling:** usar modo de verificacao do BAT e git archive HEAD para testar sem iniciar automacoes. Custo: arquivos ainda nao commitados da origem nao entram no pacote (propriedade de seguranca); registrar hash do HEAD e revisar antes da preparacao definitiva.
- **Ruling:** nao copiar dados/credenciais/sessoes automaticamente nem alterar pol. PowerShell global. Custo: operador precisara configurar e verificar acesso ao WhatsApp e OAuth no Windows novo apos migracao aprovada.
- **Ruling:** manter PR em draft e nao executar merge dos PRs empilhados. Custo: codigo da versao 2.0 ainda nao esta em producao.

## Pendencias antes de producao

- [ ] Conectar e identificar PC novo no Desktop Commander.
- [ ] Aprovar revisao independente dos PRs #38–#44 e estrategia de integrar branch-base de 58 commits.
- [ ] Criar backup local protegido no C:, validar integridade/restauracao no computador definitivo.
- [ ] Testes reais sem envios de WhatsApp, Meli OAuth e extensao em navegador.
- [ ] Aprovar deploy controlado e rollback antes de mudar a instalacao principal.
