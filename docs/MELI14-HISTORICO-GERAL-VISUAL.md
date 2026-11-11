# MELI-14 — Histórico de preço geral na Central
Data: 11/11/2026 | Branch: feat/meli14-visao-marketplace-20261111

## Objetivo

Adicionar uma visualização profissional, responsiva, somente de leitura e
semanticamente correta para **preço geral do marketplace**, separada dos preços
Pix e cartão existentes no Histórico Inteligente (MELI-11).

## Componentes alterados

- `src/painel/public/historico-precos.html`: terceiro filtro "Geral" em "Tipo
  de preço", com painel de análise, gráfico de valores observados, tabela
  independente e avisos de confiabilidade. O usuário pode voltar a Pix/Cartão.
- `src/painel/public/historico-precos.js`: modo de preço geral com dados
  demonstrativos somente em `?demo=1`; interpretação somente de amostras
  previamente autorizadas com os campos `preco_geral_marketplace`,
  `modalidadePagamento=nao_informada`, `disponibilidade=indeterminada`,
  `podePublicar=false` e `podeCompararComoDesconto=false`.
- `src/painel/public/historico-precos.css`: layout de cards responsivo,
  estilos da proteção comercial e correção explícita de visibilidade de
  painéis `[hidden]`.
- `src/painel/historico-marketplace-http.ts`: rota local
  `GET /api/historico-precos/marketplace`, que **retorna zero observações,
  autorização pendente e coleta desativada**, com cabeçalhos no-store,
  nosniff e referrer-policy. Qualquer método não GET retorna 405.
- `src/painel/server.ts`: registra somente essa rota de leitura. **Não
  conecta SQLite real, não chama API do Mercado Livre, não aciona WhatsApp,
  nem ativa qualquer monitor.**
- `tests/meli14-marketplace-ui.mts`: integração de Chrome real em três
  resoluções e ensaio de contrato simulado, mais teste de faixa lateral
  por pixel em captura de página inteira.
- `package.json` e `.github/workflows/validar-afiliados.yml`: novos
  testes, capturas de interface e CI.

## Semântica comercial e segurança

1. Preço geral por canal não equivale a Pix ou cartão.
2. Preço geral não atesta estoque, comissão ou desconto comprovado.
3. A visualização de amostras de teste é opt-in em `?demo=1`; sem esta URL,
   a página exige autorização de fonte e zero itens enquanto não houver.
4. Nenhuma série de preço geral aumenta o indicador de "Base suficiente" para
   divulgação; "Ofertas liberadas" permanece zero no modo Geral.
5. Dado autorizado futuro só será exibido quando a API confirmar simultaneamente
   `autorizacaoConfirmada` e `coletaHabilitada`, a categoria esperada e
   amostras sem capacidade de publicação. Testes simulam e verificam o filtro.
6. A nova API é somente leitura e no momento falha fechada; nenhuma fonte
   de preços de terceiros foi autorizada pelo suporte no caso 403.
7. Não criar base SQLite de produção nem misturar preços com MELI-11.
8. Não enviar mensagens, gerar cupons, publicar ofertas ou atualizar
   links de afiliados a partir das amostras apresentadas.

## Critérios de homologação

- `npm run typecheck`
- `npm run test:meli14-ui`: 1440, 768 e 390 px, gráfico, tabela, filtros,
  busca, alternância, demo opt-in, API bloqueada, contrato positivo e
  negativo mockado, zero writes e zero chamadas de rede externa.
- `npm run test:meli10e-ui` e `npm run test:meli11-ui`: regressões Pix/cartão.
- `npm run test:meli13`: armazenamento de preço geral.
- `npm run test:ux-contrato`: rodapé e sidebar com tema compartilhado.
- GitHub Actions: obrigatório passar antes do merge.

## Próxima etapa, sob autorização expressa da plataforma

1. Obter confirmação do Mercado Livre sobre terceiros, escopo, taxas e
   retenção da API de preços para APP_ID de afiliados.
2. Desenvolver um registro de licença auditável, transações de leitura no
   banco da MELI-13 e limpeza independente de revogação.
3. Fazer canário operacional de poucas amostras sem publicação, verificar
   timestamps/proveniência, limite e política de 403/429.
4. Só após isso expor observações reais em `/api/historico-precos/marketplace`.
   Não ativar automações de WhatsApp junto com este projeto de leitura.

**Limite da entrega:** implantação de interface e rota sem conteúdo
operacional. Não equivale a um coletor real funcionando.
