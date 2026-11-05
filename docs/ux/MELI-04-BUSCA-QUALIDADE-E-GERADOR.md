# MELI-04 — Busca de qualidade e Gerador de Links (05/11/2026)

## Evidência de campo

O gerador oficial do Mercado Livre mostrou URL de catálogo
https://www.mercadolivre.com.br/p/MLB74501173 e etiqueta visível, porém botão
"Gerar" DESABILITADO. Diagnóstico técnico original:
URL_PRESERVADA, CAMPO_EDITAVEL, VALIDACAO_NATIVA_SEM_ERRO,
ETIQUETA_NAO_DETECTADA, BOTAO_DISABLED, SEM_ALERTA_VISIVEL.

Isso NÃO comprova a causa do bloqueio. A etiqueta da captura é componente
personalizado, não <select> nativo. A recusa pode depender da elegibilidade
real do anúncio ou da etiqueta; a extensão não deve forçar um botão desabilitado.

Também havia falha no algoritmo de busca: MercadoLivreApiFonte.buscar()
retornava após obter 5 anúncios quaisquer, antes de avaliar descontos posteriores.
O preview só então aplica 20%/histórico; anúncios elegíveis na página seguinte
não eram considerados. Outros problemas: estoque não confirmado, uso de
URL genérica /p/ do catálogo e resposta 429 que podia ser engolida.

## Mudanças de busca

1. Orçamento técnico limitado de até 25 produtos por termo (configurável pelo
   nome MERCADOLIVRE_PRODUCTS_CHECKED_PER_QUERY com limites 5..60).
2. Percorrer todas as páginas permitidas até o orçamento, sem terminar nos
   primeiros 5 anúncios. Devolver os 5 melhores candidatos VERIFICADOS.
3. Publicação: condição "new", vendedor identificável, estoque POSITIVO
   confirmado pelo catálogo e por GET /items/{id}, anúncio ativo, preço >0
   e permalink HTTPS oficial do anúncio exato. Reputação verde continua
   exigida como já era; nunca inventar elegibilidade no programa de afiliados.
4. Referência de preço anterior só reaproveitada após conferir que o preço
   atual não mudou. Se a API detalhada mudar, não inventar desconto.
5. Resposta 429 (incluindo reputação em lote) sobe ao painel para permitir
   seu backoff, sem mascarar como zero ofertas nem insistir indefinidamente.
6. Contadores de produtos analisados, sem estoque/reputação, item desatualizado,
   selecionados e categorias consultadas nos logs reais.
7. Depois das categorias normais autorizadas, tentar até duas categorias
   extras da MESMA lista aprovada somente se não houver elegível; a rotação
   avança pelo número real de categorias consultadas. Não alterar desconto
   mínimo (20%), cooldown de envio (24h), prévia (120min), cadência do monitor
   ou outras fontes.

## Gerador

A extensão de produção (Conector 02, 0.4.5) continha ~200 linhas de correções
que não existiam no GitHub (versão 0.3.0). O código instalado foi importado
integralmente para o branch antes de aplicar qualquer ajuste, para NÃO regredir.

- Conector 0.4.6 passa a diferenciar "etiqueta customizada visível, não
  verificável" de "etiqueta ausente", sem revelar o valor no diagnóstico.
- Mensagem visual curta e quebra de palavra correta; detalhes técnicos
  continuam nos registros da Central.
- Sem alterar disabled, forçar clique, contornar a elegibilidade do programa
  ou gerar links falsos. Em recusa, continuar usando o fallback manual.

## Testes obrigatórios

- tests/mercadolivre-busca-qualidade.mts: API simulada, oferta de 55% na
  SEGUNDA página, estoque 0, anúncio pausado, reputação, URL oficial de item,
  rejeição de domínio inválido, validação de preços e HTTP 429.
- tests/mercadolivre-gerador-dom.mts: duas telas simuladas no Chrome (botão
  disabled e enabled), etiqueta customizada, reconhecimento sem falsos
  positivos, link apenas gerado após clique habilitado, sem POST real.
- npm run test:mercadolivre-auth preserva refresh token e 401.
- CI: typecheck e todos os testes da UX-02/03, painel, WhatsApp e Amazon.

## Deploy / estado

NÃO implantar enquanto operacaoEstado = offer-pending, houver envio em andamento
ou monitor ativo com oferta não reconciliada. Nunca descartar oferta do usuário
por conta própria e nunca alterar .env/segredos ou histórico.

Quando estiver livre: backup SHA256 dos 4 arquivos envolvidos e extensão,
comparar hashes e aplicar apenas os arquivos testados. Atualizar a extensão
no diretório realmente usado pelo Chrome; o usuário deve recarregá-la em
chrome://extensions quando o fluxo de links estiver ocioso. Verificar em
navegador real SEM tentativa de envio e com captura privada.

A própria API/portal determina se um item pode gerar link de afiliado.
A melhora de seleção reduz candidatos inválidos, mas não garante que o botão
Gerar ficará habilitado para todo anúncio.
