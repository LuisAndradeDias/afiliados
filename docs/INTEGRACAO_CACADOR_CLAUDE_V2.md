# Caçador Claude × Caça Promos VIP — V2

Data: 13/11/2026.
Branch: feat/cacador-catalogo-central-v2, originada da V1 / PR #82.
Estado: integração **em desenvolvimento**, não mesclada ou implantada.

## Componentes entregues

| Origem | Adaptação ao projeto | Arquivo |
| --- | --- | --- |
| Memória do Claude | SQLite por ID, vendedor, variante e pagamento; menor preço em janelas de 6h, mediana; custo total separado do preço do item | src/cacador/catalogo.ts |
| Score de achadinhos | Desconto, avaliação, vendidos, frete, FULL, comissão estimada e sinais históricos. Cupom não confirmado não pontua | src/ofertas/cacador-claude.ts |
| Vitrine e Caçador | Nova tela /cacador: seis indicadores, filtro de canal/situação, catálogo, gráficos, formulário e detalhes | src/painel/public/cacador.html, .css, .js |
| Navegação | Rota adicionada ao menu unificado e à home, preservados os módulos anteriores | unified-nav.js, central.html |
| API local | GET catálogo/produto e POST de observação manual/encaminhamento com validação de origem, tamanho de corpo e URLs | src/painel/cacador-http.ts |
| Mercado Livre | Reaproveita validação e persistência de rascunhos assistidos; exige reconfirmação de preço, disponibilidade, reputação e link | mercadolivre-assistido.ts |
| Shopee | Reaproveita validador e rascunho manual; sem ativar API de descoberta | shopee-rascunhos.ts |
| Amazon | Registrável na vitrine para revisão manual; sem API de produtos ou publicação automática | Catálogo |
| Migração Python | Importador somente de tabelas de produtos e preços do SQLite legado | tools/cacador/migrar-claude.mts |

O banco separado de desenvolvimento é data/cacador-catalogo.sqlite e está na lista de exclusão do Git. Não substitui bancos de produção.

## Dados de origem do Claude, migração feita no ACER

Fonte: I:\Meu Drive\robo_ofertas\ofertas.db, aberto **somente para leitura**.
- 117 produtos / 117 observações consultados.
- 49 produtos / 49 observações compatíveis e importados para banco isolado.
- 68 entradas rejeitadas por validação de formato ou requisitos; nunca inventadas.
- Zero publicações, zero envios e zero operações de busca.
- Nenhuma tabela de cliques, envios, contatos, mensagens, sessões de WhatsApp ou eventos importada.

Cópia sanitizada no diretório privado do usuário:
C:\Users\JUNIOR\AppData\Local\Projeto04\trabalho-seguro\integracao-cacador-claude\importados\catalogo-claude.sqlite

Outra cópia local para prévia no checkout isolado:
C:\Users\JUNIOR\AppData\Local\Projeto04\trabalho-seguro\integracao-cacador-claude\repo\data\cacador-catalogo.sqlite

Ambas são dados privados; NÃO incluir em Git, PR ou screenshots públicas.

O banco legado não contém vendedor, variante, forma de pagamento e frete completos por observação. Importações recebem vendedor/variante desconhecidos, modalidade geral, frete desconhecido, disponibilidade não confirmada. Datas locais do Python são interpretadas como horário brasileiro UTC−03, explicitamente; não confundir com preço atual verificado.

## Como repetir

Prévia sem escrever no destino (PowerShell, checkout isolado):
  node .\node_modules\tsx\dist\cli.mjs tools\cacador\migrar-claude.mts --origem "I:\Meu Drive\robo_ofertas\ofertas.db"

Para importar em outro destino, adicionar --destino CAMINHO_SEPARADO.sqlite --aplicar. Importador recusa destino na pasta de origem. Não apontar para banco operacional nem usar banco já em uso.

## Barreiras de segurança

- Nenhum coletor real foi carregado e não foram adicionadas rotinas de contornar bloqueios, endpoints privados ou verificações do Mercado Livre.
- A nova tela **não** liga monitores nem envia WhatsApp. O núcleo operacional do projeto foi mantido.
- A indicação “Para revisão” é triagem humana e NUNCA uma aprovação: todos os produtos trazem podePublicar=false.
- A memória compara preço do item separadamente de custo total. Frete não informado impede classificar queda do custo total.
- Cupom no registro é apenas código não verificado; não aplica redução de preço, não afirma elegibilidade nem fornece comissão garantida.
- Link informado não prova atribuição. Rascunhos são confirmados manualmente e passam novamente pelas políticas e validações existentes.
- Para Mercado Livre, somente local/canais autorizados devem ser usados; o destino privado não é liberado por esse módulo.
- A confirmação de envio e deduplicação do WhatsApp do protótipo Python não são transplantadas, para evitar reenvios ambíguos.
- Nenhum deploy na máquina Luis (offline) foi tentado.

## Verificações

npm.cmd run typecheck
npm.cmd run test:cacador-claude
npm.cmd run test:cacador-integracao
node --import tsx --test tests/cacador-migracao.mts
npm.cmd run test:ux-contrato

Testes de API/SQLite: 8 aprovados; Caçador visual sintético: 1595, 1280, 768, 390 px, zero POST/DELETE no teste visual. Teste de migração: origem sintética imutável, só produtos e preços, e destino separado. Todos os screenshots são sintéticos.

## Pendências explícitas

1. Não há descoberta real automática ativada. Uma fonte só pode ser conectada depois de autorização documentada e políticas do marketplace revisadas, além de credenciais legítimas.
2. Histórico legado insuficiente para comparar vendedor, variante, Pix/cartão ou frete não pode receber rótulos de custo total verificado.
3. Cupom precisa de prova de aplicabilidade por anúncio e elegibilidade da conta.
4. Publicação só após aprovação e canal permitido, revalidação de preço/estoque, idempotência e confirmação real.
5. Revisão do PR empilhado e evidências; merge; backup e teste do runtime; deploy incremental na instalação operacional, não feito.

**Código integrado em desenvolvimento não é sinônimo de automação homologada ou disponível em produção.**
