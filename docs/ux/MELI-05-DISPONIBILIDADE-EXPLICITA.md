# MELI-05 — Sinais explícitos de indisponibilidade

Data: 2026-11-05. Base: PR #61 (MELI-04).

## Problema comprovado no Acer
Na rodada de 15:18 (05/11), a busca recém-implantada analisou 25 produtos em
cada uma de quatro categorias (notebook, smart tv, fone bluetooth e air fryer)
e reportou 0 anúncios confirmados, 25 rejeitados por
"sem_estoque_ou_reputacao" em cada categoria. O campo
`available_quantity` da API de outros vendedores pode vir ausente, e a
MELI-04 tratava esse campo ausente como estoque 0, removendo candidatos
antes mesmo de consultar os detalhes dos anúncios.

## Regra aplicável
- Mensagens explícitas identificadas nos dados retornados pelo Meli:
  "estoque esgotado", "produto indisponível", "oferta indisponível",
  "ofertas indisponíveis", "sem estoque", "produto esgotado", "out of stock",
  "indisponível para compra" e equivalentes.
- Quando o Meli fornece um número de estoque 0 (ou negativo),
  tratar como esgotamento explícito e DESCARTAR.
- Quando o Meli não fornece quantidade (`null` ou ausente), NÃO
  presumir esgotamento. Continuar para a validação do anúncio e
  apresentar o sinal nos logs `estoque_nao_informado`.
- Preservar as demais validações: anúncio ativo, novo, vendedor com
  reputação aprovada, preço positivo, HTTPS e ID da publicação correto,
  desconto mínimo 20%, histórico 24h e preview 120min.
- A regra **não afirma que um anúncio está em estoque** quando a API
  não revelou esse dado; ela somente não o rejeita antecipadamente.
- Mensagens do site exibidas somente no navegador não necessariamente
  estarão disponíveis na API. Não reivindicar detecção de DOM que não
  foi implementada. O portal oficial continua autoridade sobre
  disponibilidade e geração de link de afiliado.

## Testes
- `tests/mercadolivre-busca-qualidade.mts`: casos de estoque 0, nulo,
  ausente, anúncio inativo, mensagem explícita mesmo com estoque positivo,
  anúncio que zera estoque no detalhe, 55% na segunda página, URL oficial
  do anúncio e backoff por 429.
- Typecheck, testes atuais de Meli e regressão da Central/WhatsApp.
- A implantação deve ocorrer apenas em estado operacional ocioso;
  fazer backup dos dois arquivos de produção, comparar SHA-256,
  não alterar dados/.env/Chrome e verificar logs da próxima rodada
  antes de reativar monitor.

## Escopo
Somente `src/fontes/mercadolivre/selecao.ts`,
`src/fontes/mercadolivre/api.ts`, teste e documentação. Sem
modificações no envio, scripts de browser, extensão, regras e UX-03.
