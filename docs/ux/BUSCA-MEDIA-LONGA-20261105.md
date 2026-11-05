# Busca média e Busca longa — contrato de integração (05/11/2026)

## Origem verificada
- Histórico Git do commit `3a955c4` (13/10/2026): existiam **Tempo médio** (10 a 25 minutos) e **Tempo curto** (5 a 12min30s), referentes ao intervalo de **publicações confirmadas**, não à duração da busca. Esse mecanismo foi retirado na limpeza de 04/11/2026 e **não** foi restaurado.
- Pedido atual: duas opções de **busca** por profundidade, denominadas **Busca média** e **Busca longa**; não ressuscitar as políticas antigas de envio.

## Escopo da mudança
A configuração é local `data/config-busca.json`, com gravação atômica. A leitura de status não grava. A seleção exige clique explícito, valida `media|longa`, é recusada com busca/ciclo ativos e persiste após reiniciar o painel. A configuração **não modifica o .env** nem credenciais do Mercado Livre.

A função `variaveisBusca()` produz override de ambiente somente para filhos de busca Amazon (`buscar`) e Mercado Livre (`mercadolivre-buscar`), tanto buscas manuais quanto pelo ciclo. Os fluxos de login, WhatsApp, links e publicações não recebem mudança de política.

## Parâmetros observados do Acer e orçamento dos modos
| Limite | Média (atual) | Longa |
|---|---:|---:|
| Categorias Amazon/rodada | 4 | 6 |
| Itens/categoria Amazon | 20 | 20 |
| Categorias Meli iniciais | 2 | 3 |
| Extras Meli sem elegível | até 2 | até 2 |
| Itens/página Meli | 20 | 20 |
| Páginas/categoria Meli | 2 | 4 |
| Produtos verificados/categoria Meli | 25 | 40 |

A busca média conserva o orçamento efetivamente configurado. A longa adiciona até duas categorias autorizadas na Amazon, uma inicial no Meli, duas páginas e quinze verificações de produto por categoria, respeitando limites máximos de segurança. A duração é variável: não há promessa de minutos fixos. O backoff HTTP 429 existente continua obrigatório.

## Regras comerciais intocadas
- Desconto mínimo de 20% e consultas das listas aprovadas.
- Cooldown de envio de 24h e prévia de 120 minutos.
- Bloqueio por esgotamento **explicitamente confirmado**; estoque não informado não vira automaticamente esgotado.
- Validação de reputação verde, anúncios ativos, preço, link oficial/afiliado e cookies/sessões existentes.
- Ciclo Amazon + Meli não acelera (cadência atual, `ALTERNATING_MONITOR_SLOT_SECONDS`). Autoenvio WhatsApp é independente.
- Não tentar contornar HTTP 403 nem inserir itens com dados não confirmados.

## Testes exigidos e implantação
- `npm run typecheck`, `npm run test:modos-busca` (unidade + servidor em pasta temporária + Playwright 1595/390), `npm run test:painel-operacional`, `npm run test:mercadolivre-qualidade` e `npm run test:ux-contrato`.
- Seleção real só após status ocioso verificado. O teste visual com dados sintéticos não pode chamar WhatsApp, APIs externas ou alterar ofertas.
- Guardar backup/hash dos arquivos operacionais; fazer deploy apenas após CI verde e aplicar avaliação read-only das quatro rotas (desktop/celular) pós-deploy.
- Não selecionar Busca longa automaticamente no Acer; conservar o modo padrão `media` até o usuário escolher.
- O bloqueio de detalhe HTTP 403 permanece um risco real separado; ampliar a busca não o resolve por si.
