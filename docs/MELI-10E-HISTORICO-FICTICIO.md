# MELI-10E — Nucleo experimental de historico SQLite (10/11/2026)

## Estado real encontrado
- Acer online, caminho de producao C:\projeto02 existente e sem .git.
- Portas 3030 e 3040 sem listener; nenhum GET da Central respondeu. Nao foram iniciadas.
- Em .env de producao os indicadores ALTERNATING_MONITOR_ENABLED, MERCADOLIVRE_MONITOR_ENABLED e WHATSAPP_AUTO_SEND_ENABLED estavam true. Valores de credenciais nao foram lidos nem copiados.
- Ha arquivos de mensagem e pacote de oferta anteriores. Nenhum conteudo pessoal foi acessado.
- PRs #67-#70 merged; main 4b36a266; cinco arquivos criticos comparados com checkout anterior tinham hashes identicos.
- Conector 02 manifest 0.4.6; backup do PR #70 presente.
- MELI-10B/C/D nao estavam incorporados a main nem na instalacao. Pacotes zip nao localizados sob Projeto04.

## Mudanca isolada
- src/fontes/mercadolivre/historico-ficticio.ts — apenas registros ficticios, fonte fixture obrigatoria, SQLite nativo de Node 24, imutabilidade, idempotencia por SHA-256, por identidade comercial e tipo de pagamento, resumos min/max/mediana 30 dias. Apenas exibe alerta habilitado com >=3 dias UTC distintos; NAO aprova oferta.
- tests/meli10e-historico-ficticio.mts — testes exclusivamente ficticios, incluindo rejeicao de datas invalidas, separacao de contexto, falha fechada para fontes reais e ausencia de publicacao.
- package.json e .github/workflows/validar-afiliados.yml — comandos de teste adicionados a CI.
- Nenhuma rota, API, coletor, WhatsApp, extensao, cron, autoenvio ou arquivo de producao alterado. Nenhuma fonte real consumida.
- Por seguranca, nenhum token ou dado pessoal foi incorporado ao git.

## Limitacoes e proximos criterios
- Este modulo nao inclui interface, importacao real, permissao de API, retencao contratual, logs de fonte nem testes visuais.
- Historico so podera operar com fontes e retencao expressamente autorizadas; API de terceiros continua bloqueada HTTP 403 observado em 09/11.
- Antes do deploy: adicionar politica de retenção e migrations reversiveis, integridade/banco com arquivo, controle concorrente, interface read-only e validacao visual.
- Nao reiniciar a Central ate conferir os flags de monitor, oferta pendente e politica de retomada, sem perder dados.
- Os numeros de testes sao apenas do ambiente simulado; nao homologam ofertas reais.
