# MELI-10A — Cupons confiáveis e evolução da descoberta/fila

> For agentic workers: use superpowers:executing-plans com TDD.

**Goal:** impedir aprovação/ranking por cupom não comprovado e rejeitar cache antigo ou sem prazo.
**Architecture:** preservar fonte API e Conector 02; distinguir desconto base confirmado de preço com cupom hipotético. Não criar fila de envio alimentada por dados não homologados.
**Tech Stack:** TypeScript/Node, node:test, Chrome/Playwright, PowerShell no Acer.
**Spec:** pedido do usuário de 09/11/2026: ofertas reais, cupons, filas e busca contínua sem pular etapas.

## Evidências
- Cache real: sete cupons coletados em 06/10, todos com validade encerrada em 02/04/2026; nenhum ativo hoje.
- Código usa descontoEfetivoPercentual de cupom de catálogo para ultrapassar filtro de 20% e aumentar score sem provar aplicabilidade.
- Chrome do perfil automatizado do projeto: /afiliados e /cupons redirecionam para /login/identification; zero produtos. HTTP 200 da tela de login não comprova coleta.
- Chrome habitual tem Conector 02 ativo, mas não oferece porta de automação. Não copiar cookies nem assumir sessões equivalentes.

## Abordagens e decisão técnica
Repetir API 403 não resolve acesso. Portal oficial autenticado é o candidato de fonte para homologação. Terceiros pagos adicionam dependência/custo não autorizado. Corrigir primeiro o defeito dos cupons; ampliar coleta apenas após evidência real e login no perfil automatizado.

## Global Constraints
Sem envios/compras/ativação de cupons. Preservar OAuth, Busca média/longa e critérios 20% / 24h / 120min. Produção só recebe correção após testes, CI, backup/hashes. Não marcar canal MELI automaticamente.

## Review Focus e tarefas
- [ ] Reproduzir com tests/meli10-cupons.mts: produto 10% + cupom 30% não pode ser aprovado por estimativa.
- [ ] Cobrir vencido, validade ausente/inválida, observação antiga/futura, compra mínima, teto, percentuais/números inválidos e não cumulatividade.
- [ ] Alterar src/afiliados/mercadolivre-cupons.ts: estimativa separada, validade/frescor, origem oficial; consulta falha não elimina observações recentes já disponíveis.
- [ ] Alterar src/fontes/types.ts para desconto estimado separado; src/ofertas/score.ts não bonifica cupom MELI não confirmado.
- [ ] Testar mensagem condicional, regressões e interface real; nenhuma oferta fictícia em produção.
- [ ] PR, revisão, CI e deploy focalizado com rollback. Registrar limites ainda existentes.

## Próximas fases propostas (ainda não implementadas)
1. Provar coleta autenticada com oferta real, preço, estoque, vendedor e link individual oficial; sem contornar 403/captcha.
2. Caixa de candidatos persistente separada de envio: encontrado -> pendente de validação -> elegível -> reservado -> enviado/descartado/expirado. Upsert por anúncio+variante; motivo de rejeição e idade visíveis.
3. Cupom como entidade com origem, código, validade, compra mínima/teto, campanha, produto e restrições de usuário/pagamento. Sem somar promoções não cumulativas; preço estimado nunca substitui comprovado.
4. Revalidação antes de preparar/enviar, reserva por um consumidor, deduplicação e confirmação real de envio.
5. Consulta contínua autorizada com worker único, orçamento de consultas, cancelamento e pausas: 401 reconexão, 403 suspender fonte, 429 Retry-After; nunca martelar a API nem monopolizar o PC de trabalho.
6. Ranking por economia real, histórico disponível, vendedor, frete/pagamento e variedade. Sem alegar menor preço histórico quando não há histórico.
7. Métricas de candidatos/elegíveis/rejeições/idade/erros/tempo por oferta. Comissão só quando informada pela fonte.

## Fontes oficiais consultadas em 09/11/2026
https://www.mercadolivre.com.br/l/visite-o-portal-de-afiliados
https://www.mercadolivre.com.br/l/promocoes
https://www.mercadolivre.com.br/l/afiliados-paginas-nao-permitidas
https://developers.mercadolivre.com.br/pt_br/guia-para-produtos/erro-403
https://developers.mercadolivre.com.br/pt_br/gerenciar-ofertas
