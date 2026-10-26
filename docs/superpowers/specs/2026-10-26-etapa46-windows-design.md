# Afiliados 2.0 — Etapa 4.6: instalacao portatil e homologacao isolada

**Data:** 2026-10-26. **Base:** PR #43 (seguranca Zod), `fix/seguranca-zod-etapa45`.
**Contexto:** somente ACER (equipamento antigo) online na conta Desktop Commander 14; na conta 13 dispositivos Luis/ACER/Andrade offline. O Windows novo definitivo nao foi confirmado.

## Problema e objetivo

A versao acumulada do Afiliados 2.0 passou em CI e auditoria, mas a aplicacao ainda nao foi instalada e homologada no Windows definitivo. O inicializador raiz `Abrir Painel.bat` usa caminho legado fixo `C:\PromocoesAfiliados`, incompatível com `C:\projeto01` e com qualquer pasta nova. O repo contem `scripts/launcher/iniciar-painel.cmd`, que ja calcula a raiz pelo local do script e usa `npm.cmd`, mas o acesso principal ignora esse mecanismo.

Criar um kit **somente de preparacao**: diagnostico sem alteracao, inicializador portatil com modo de verificacao inofensivo, e gerador de instalacao de homologacao baseado exclusivamente em arquivos do Git versionados. Nao executar servidores, OAuth, Chrome ou disparos por padrao.

## Solucoes consideradas

1. Copiar `C:\projeto01` inteiro, incluindo perfis e `.env`, para o PC novo: rejeitada, risco de dados, credenciais e conflito de WhatsApp.
2. Aplicar merge/deploy da cadeia #38-#43 diretamente no Windows: rejeitada, exige revisao independente, backup e sessao real.
3. **Escolhida:** versionar scripts de preparacao/diagnostico, corrigir o caminho fixo no launcher e testar em worktree isolada no ACER. Somente apos novo Windows online executar checklist e preparar instalacao paralela; nenhuma migracao automatica de dados.

## Requisitos de seguranca

- Sem PostgreSQL; sem Google Drive; backup futuro apenas no disco C: com protecao adequada, e historico GitHub para codigo.
- Nenhuma mudanca ou leitura do conteudo de `.env`, `data/`, `dados/`, tokens, contato, grupo, QR, sessao e perfis Chrome.
- Não executar `npm run automatico`, envio real, API Meta paga, monitor, coleta, WhatsApp ou oauth de producao.
- Nao instalar o projeto sobre pasta existente; permitir apenas novos caminhos de homologacao na unidade C:; nunca dentro do repositório ou `C:\projeto01`/ `C:\PromocoesAfiliados`.
- Instalar dependencias somente mediante dois switches explicitos `-Execute -InstallDependencies`, com `npm.cmd ci --ignore-scripts --no-audit --no-fund` e sem Playwright download.
- A fonte do preparo é `git archive HEAD`, em checkout limpo e só com arquivos versionados; recusar se `.env`, `data/` ou `dados/` estiverem rastreados e puderem ser copiados.
- O modo diagnostico retorna apenas informacoes tecnicas genericas; nao imprimir credenciais ou host/user em logs publicos.
- Corrigir `Abrir Painel.bat` para caminho relativo `%~dp0`, com `--verificar` seguro e sem abrir navegador ou levantar servidor.
- O modo normal deve delegar ao launcher existente (preferir EXE caso presente, fallback `scripts/launcher/iniciar-painel.cmd`), sem executar outros robos.
- CI Windows usa scripts locais em diretorio temporario e garante que nao haja `.env`, `data/`, `dados/`, `.git`, `node_modules` em preparo de teste.
- Criar PR draft empilhado sobre #43, manter #38–#43 nao mesclados. Revisao independente e maquina definitiva continuarao pendentes.

## Aceite

- TDD vermelho antes das melhorias do launcher/preparo, verde depois.
- Preflight gera JSON sem efeitos colaterais, identifica ferramentas/portas mas nao exige creds.
- Launcher verifica de qualquer diretorio e nao usa caminho hardcoded.
- Preparo por padrao apenas descreve operacao. Executado explicitamente no diretório C: de homologacao cria copia limpa sem arquivos privados e sem iniciar servicos.
- Recusa sobrescrita e destinos perigosos; permite execucao segura sob testes controlados.
- CI Windows verde, auditoria npm e TypeScript (CI heredada), sem envios.
