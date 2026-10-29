# Diagnóstico do funil de ofertas — somente leitura

## Objetivo

Homologar a versão visual implantada e diagnosticar, com segurança, os gargalos de Amazon/Mercado Livre **sem simular o envio de uma mensagem nem alterar o status de um canal**.

A fonte operacional dos números é exclusivamente a Central local. Os exemplos de testes utilizam dados fictícios, não registros de contatos, links ou lojas reais.

## Como usar no próprio computador autorizado

Com o serviço da Central 3030 aberto, execute na raiz do projeto:

```powershell
node scripts/auditar-funil-ofertas.cjs
```

O script solicita **apenas duas leituras GET** no localhost:

- `/api/status`: estado, monitores, bloqueio de canal, backoff do Mercado Livre, totais de cupons.
- `/api/revisao`: modo somente leitura, totais e códigos de motivos de bloqueio.

O resultado exibe um JSON com dados **agregados e permitidos**, sem título dos produtos, mensagens, nomes de clientes, links, telefones, grupos, histórico de logs, tokens, credenciais ou segredo do n8n. A aplicação recusa hosts externos e redirecionamentos.

Não copiar o JSON para observabilidade externa sem revisar o conteúdo e a política de privacidade.

## O que cada sinal significa

| Sinal | Interpretação segura | Próxima ação |
| --- | --- | --- |
| CANAL_NAO_HOMOLOGADO | Publicação não liberada para o grupo | Concluir verificações comerciais; não contornar o bloqueio |
| PRECO_SEM_PROVA_RECENTE | Preço ainda não demonstrado em fonte aceita | Revalidar preço/condições de pagamento no anúncio de fato |
| ESTOQUE_NAO_HOMOLOGADO | Estoque/compra efetiva não comprovados | Revalidar oferta do vendedor vencedor |
| ATRIBUICAO_INCONCLUSIVA | Link/atribuição de afiliado não confirmados | Verificar link oficial, sem presumir comissão |
| REVISAO_E_REVALIDACAO_OBRIGATORIAS | Registro não reúne evidências para aprovação | Manter bloqueado até a revisão |
| Cupons observados != cupons ativos | Catálogo não demonstra aplicabilidade ao produto | Somente contar como ativo após confirmação na compra sem finalizar pedido |
| Backoff > 0 | Consultas pausadas após restrição/limite | Respeitar o backoff, sem contornar limitações |

## Correção de robustez do buscador ML

O antigo cálculo de `MERCADOLIVRE_SEARCH_PAGES_PER_QUERY` propagava `NaN` para o limite do laço, fazendo a busca retornar zero produtos silenciosamente quando a configuração era inválida.

Agora, valores não finitos usam **3 páginas**; valores numéricos finitos são truncados e limitados a **1–5 páginas**, mantendo o teto de consultas da API.

Teste de regressão: `tests/mercadolivre-descoberta.mts`; o teste foi observado falhando antes da correção e passando depois. Testes adicionais sobre agregados sem informações sensíveis: `tests/auditoria-funil-ofertas.mts`.

## Segurança e implantação

- Mudanças do buscador são desenvolvidas e verificadas em branch; não instalar durante execução de tarefas.
- Este diagnóstico não inicia monitor, não chama `POST /api/action`, não modifica WhatsApp, estoque, cupom ou autenticação, não envia convites e não acessa credenciais.
- A Central 3030 permanece autoridade de status; a Central de contatos é um serviço separado.
- Resultados operacionais são instantâneos e não substituem uma aprovação de canal nem prova de comissão.
- O processo de inicialização automática do Windows permanece fora deste escopo.

## Verificações

- `node --import tsx --test tests/auditoria-funil-ofertas.mts`
- `node --import tsx tests/mercadolivre-descoberta.mts`
- `node --import tsx --test tests/mercadolivre-resiliencia.mts tests/mercadolivre-disponibilidade.mts tests/etapa53-preco-vendedor-estoque.mts tests/etapa54-preco-contextual.mts tests/etapa55-investigacao-sem-vencedor.mts tests/etapa56-anuncio-direto.mts`
- `npm run typecheck`
- Workflow do GitHub com os controles visual e operacional simulados.

Antes de qualquer atualização ao vivo, executar backup por SHA-256, garantir estado ocioso, homologação comercial e rollback.

## Etapa seguinte — consistência entre oferta e link oficial (29/10/2026)

Auditoria de domínio e destino foi reforçada de modo fail-closed, sem requisição adicional:

- A auditoria somente leitura de anúncio individual `/items/MLB...` compara agora o ID publicado no permalink oficial com o próprio `anuncioId`. Link de outro anúncio, rota de compra disfarçada ou porta não padrão recebe `ANUNCIO_LINK_NAO_OFICIAL`, e a consulta de preço contextual não prossegue.
- A ficha de Revisão compara o produto `/p/MLB...` ou anúncio direto `/MLB-...` do Mercado Livre com os IDs da oferta. Para a Amazon, compara o ASIN de `/dp/ASIN` ou `/gp/product/ASIN` com o `produtoId` registrado.
- Identidades explicitamente divergentes recebem `LINK_DESTINO_DIVERGENTE`, `estado=divergente` e ficha bloqueada. URL com porta não padrão recebe `LINK_NAO_VALIDADO`.
- Links abreviados de programas oficiais podem permanecer com `LINK_FORMATO_RECONHECIDO` quando somente o formato for conhecido. **Isso não comprova destino, comissão, estoque, condições de pagamento nem afiliação.** O campo `podePublicar` do painel de revisão continua sempre `false`.

Os cenários foram reproduzidos primeiro como testes falhando e somente então corrigidos. Testes: `tests/etapa56-anuncio-direto.mts` e `tests/etapa58-revisao.mts`.

**Limite:** sem dados oficiais de atribuição/comissão e sem homologação do canal, não tentar liberar envio. Estas correções aperfeiçoam a interpretação das evidências, não fabricam evidências.
