# MELI-07 — Pesquisa e plano de correção (06/11/2026)

## Evidência, sem presumir solução
A autorização foi renovada pelo mecanismo OAuth existente (token vencido). GET /users/me retornou 200 com conta ativa. O mesmo anúncio teve /items/{id} = 403 e /items/bulk = HTTP 200 com status_code 403 no elemento. /sale_price também negou acesso. Portanto HTTP 200 do envelope não prova acesso nem validação comercial. Uma consulta limitada ao catálogo retornou 429 e foi interrompida imediatamente. A página pública /ofertas, em Chrome isolado sem login, retornou 403; não houve CAPTCHA resolvido, proxy, extração de cookies ou contorno de bloqueio.

## Fontes oficiais consultadas
- https://developers.mercadolivre.com.br/pt_br/itens-e-buscas — migração para /items/bulk e /users/bulk; status_code por elemento; não garante permissão.
- https://developers.mercadolivre.com.br/pt_br/guia-para-produtos/erro-403 — acesso negado, escopos, usuário proprietário e permissões; não significa estoque esgotado.
- https://developers.mercadolivre.com.br/autenticacao-e-autorizacao — 401/403/429 têm significados distintos.
- https://developers.mercadolivre.com.br/buscador-de-produtos — o catálogo descreve produtos, mas um produto ativo não garante anúncio comprável.
- https://www.mercadolivre.com.br/l/escolha-produtos-para-recomendar — recomenda produtos do portal de afiliados e Ofertas do dia; caminho comercial pertinente, ainda não validado pela automação desta etapa.

## Alternativas avaliadas
1. Ampliar cegamente páginas/categorias: não resolve autorização e aumenta custo/requisições. Descartado.
2. Trocar /items por /items/bulk: rota oficial testada, mas a negação persiste no elemento. Não implantar como suposta correção.
3. Corrigir perdas locais de candidatos e interromper erros estruturais com diagnóstico verdadeiro. Escolha desta etapa; não promete remover a restrição externa.
URLs construídas como se fossem permalinks verificados e serviços pagos de terceiros não serão usados. A captura de ofertas no portal autenticado só deve ser ativada após comprovar os campos e revalidação; não é implementada por suposição.

## Escopo aprovado pelo pedido de execução
Manter Node/TypeScript, modos médio/longo, categorias, mínimo 20%, cooldown 24h, prévia 120min e fluxo WhatsApp. Não enviar mensagens, iniciar monitor, desativar autoenvio ou trocar credenciais de identidade. Nenhuma nova dependência.

## Plano (execução inline)
- [x] Criar teste que falha: primeiro anúncio fica indisponível no detalhe, segundo vendedor verde do mesmo produto válido deve ser aproveitado; máximo três detalhes por produto.
- [x] Criar teste que falha: 429 em qualquer etapa faz somente uma tentativa, preserva Retry-After numérico/data e interrompe a rodada; timeout explícito de rede.
- [x] Criar teste que falha: 403 de detalhe/reputação/catálogo é erro de permissão, nunca resultado vazio, nunca novo estoque esgotado.
- [x] Implementar erros tipados e fallback limitado a outros anúncios válidos para indisponibilidade/404; não tentar contornar um 403.
- [x] Integrar códigos/avisos ao preview e ao painel: 403 deve aparecer como restrição de acesso; 429 deve respeitar a espera indicada; Amazon mantém funcionamento independente.
- [ ] Validar por testes offline com respostas sintéticas, auditoria visual desktop/celular, GitHub Actions, backup e hashes antes de deploy.

## Critérios de honestidade
Separar ganho comprovado nos testes de ganho real no marketplace. Token autenticado não equivale a acesso aos anúncios. Sem evidência real, não declarar oferta apta, estoque confirmado, desconto/comissão comprovados ou problema comercial resolvido.

## Evidencia de verificacao local
Typecheck e todas as suites locais executadas passaram. A suite nova inclui 12 cenarios de recuperacao/erros, dois processos reais de preview com rede simulada e dois cenarios HTTP de painel com quatro capturas desktop/mobile. Cenarios vermelhos foram observados antes das correcoes. Reclassificacao por preco confirmado e preservacao de intervalos de requisicao maiores foram adicionadas apos revisao. Revisao feita pelo proprio implementador; nenhum revisor independente. CI e deploy seguem como gate antes da conclusao operacional.
