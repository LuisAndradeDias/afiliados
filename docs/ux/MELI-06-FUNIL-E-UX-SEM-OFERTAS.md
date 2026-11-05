# MELI-06 — Funil de seleção verificável e apresentação honesta de busca vazia

## Evidência de 05/11/2026 — Acer
- Ambiente operacional: `C:\projeto02`; monitor de ofertas pausado, nenhum envio ou oferta pendente.
- Consulta real isolada, usando token vigente em modo manual (sem renovação), somente GET e sem escrever arquivos de operação.
- Amostra de cinco categorias autorizadas: 33 catálogos examinados, 58 publicações retornadas (Smart TV: 1; Fone Bluetooth: 45; Air Fryer: 5; Ferramentas: 7; Notebook: 0).
- As 58 publicações passaram na triagem técnica inicial e não informavam quantidade; nenhuma trouxe mensagem explícita de indisponibilidade. Essa evidência NÃO comprova compra disponível, desconto, permalink de anúncio nem comissão.
- Busca final separada de Fone Bluetooth: oito catálogos, 45 publicações, dois detalhes de anúncio com HTTP 403, quatro respostas 404 ao consultar publicações, nenhuma oferta validada. Vendedores sem reputação verde/informação adequada também impediram seleção. Nenhum HTTP 429 nessa consulta.

## Correção incremental
- `selecao.ts`: função pura `resumirPublicacoes` para contabilizar explicitamente quantidade ausente, estoque realmente esgotado, mensagem de indisponibilidade, condição, vendedor, preço, identificador e candidatas técnicas. Um anúncio pode aparecer em mais de um motivo; NÃO somar motivos como produtos exclusivos.
- `api.ts`: distinguir endpoint de publicações HTTP 404, resposta vazia, candidatura técnica, sem vendedor aprovado e HTTP 403 de detalhe. O log `Mercado Livre funil:` descreve por categoria quantos anúncios passaram por cada etapa, sem expor tokens ou dados privados.
- UI local: uma última busca sem ofertas é apresentada como resultado de busca (neutro), não como falha técnica. Erros efetivos de autenticação, rede ou operação continuam alertas.
- Os critérios comerciais e de segurança foram mantidos: desconto mínimo 20%, envio 24 h, prévia 120 min, novo/ativo, reputação verde, preço e permalink oficiais, bloqueio explícito de esgotamento. Nenhum envio ou monitor foi acionado.

## Validação
- Testes sintéticos cobrem indisponibilidade explícita, estoque omitido, separação de HTTP 404 e HTTP 403, sem fazer rede real.
- Auditoria visual de produção existente: quatro rotas em desktop (1595 px) e celular (390 px), apenas GET. Capturas de produção permanecem no Acer e não vão ao GitHub.
- Não foi comprovada ainda uma oferta real totalmente elegível; HTTP 403 no detalhe continua limitação do endpoint/credencial e não deve ser contornado.
- O estado `error` persistido no backend não é apagado por esta mudança; a interface apresenta o contexto de nenhuma oferta somente quando o texto da última operação explicita esse resultado.

## Próxima decisão técnica, baseada em evidências
Investigar métodos **oficiais e autorizados** de confirmação do anúncio e da reputação quando o detalhamento de terceiros retorna HTTP 403. Não falsificar permalink, estoque, cupom, vendedor ou elegibilidade apenas para elevar a quantidade de ofertas.
