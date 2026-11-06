# MELI-08 — HTTP 403 dos anúncios de terceiros e seleção assistida (06/11/2026)

## Evidências observadas no Acer (somente leitura)
- API reconhece 17 permissões no aplicativo e as mesmas 17 no grant atual. Conta ativa; token válido.
- Matriz controlada de 9 GETs, sem escrever dados comerciais:
  - GET /users/me -> HTTP 200; conta ativa.
  - GET /users/{id}/items/search -> HTTP 200; total=0 anúncios próprios.
  - GET /products/search -> HTTP 200; quatro resultados.
  - GET /products/{id} -> HTTP 200 (dois produtos; sem permalink de anúncio nem preço confirmado).
  - GET /products/{id}/items -> um 404 e um 200 com publicações.
  - GET /items/{id} -> HTTP 403, error access_denied para anúncio de terceiro encontrado na competição.
  - GET /items/bulk?ids={id} -> HTTP 200 externo, status_code 403 no item.
- Testes anteriores com nova autorização: GET /items/{id}/sale_price -> HTTP 403 e outros dois anúncios de terceiros /items/{id} -> HTTP 403.
- Nenhuma publicação real aprovada. Não foi comprovado se a restrição é exclusiva de titularidade ou tem mais de uma causa; IP/limites de aplicação devem ser conferidos com o suporte.
- O código de busca já interrompe o ciclo no primeiro HTTP 403/429 e preserva cadência. **Não usar chamadas anônimas ou rotas alternativas para contornar restrições.**

## Referências oficiais
- Motivos possíveis para 403 e necessidade de verificar autorização/titularidade: https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao/erro-403
- Proteger dados de outros sellers; autorizar acesso só com permissão explícita: https://developers.mercadolivre.com.br/pt_br/lojas-oficiais/controle-de-acesso-e-autorizacao
- Migração GET múltiplos itens para /items/bulk e validação status_code por item: https://developers.mercadolivre.com.br/pt_br/itens-e-buscas
- Afiliados: produto individual + link gerado na Central ou Barra: https://www.mercadolivre.com.br/l/comece-a-recomendar
- Afiliados: recomendação de produtos/ofertas e elegibilidade: https://www.mercadolivre.com.br/l/escolha-produtos-para-recomendar
- Regras de divulgação — verificar canais públicos: https://www.mercadolivre.com.br/l/afiliados-onde-compartilhar-links

## Solução incremental: rascunhos por seleção assistida
A Central tinha um fallback que só salvava link de afiliado **para uma oferta já produzida pela API**. Como o 403 bloqueia essa oferta, a funcionalidade não resolve o gargalo.

A nova ferramenta dentro de Configurações > Ferramentas > Mercado Livre:
1. O usuário seleciona um **produto específico** na Central de Afiliados e Criadores do Mercado Livre.
2. Gera um link oficial (meli.la ou /sec/) usando a própria conta.
3. Informa nome, link de produto, link oficial, preço atual e preço anterior.
4. Confirma expressamente: preço na página, disponibilidade sem esgotamento, vendedor verde e link do produto correspondente.
5. O servidor só salva **rascunho-nao-publicado** no arquivo local `data/mercadolivre-rascunhos-assistidos.json`.

O backend valida HTTPS e domínio exato, rota de anúncio individual (não página de ofertas/busca/categoria), desconto mínimo de 20%, preços positivos, confirmação completa, não duplicação, limite de 100 itens, escrita atômica, tamanho limitado e origem local. O frontend usa textContent e não interpreta HTML de título. Não altera arquivos de ofertas operacionais nem executa WhatsApp, gerador de links ou agendadores. Os dados foram conferidos por humano e **não comprovados por API**; jamais apresentar como "oferta confirmada automaticamente".

## Testes e deployment
- Testes unitários: campos, desconto, preço, URL, permissões declarativas, duplicates, corrompidos; nenhum arquivo operacional criado.
- HTTP em diretório temporário: GET, POST, DELETE, origem local, cross-site negado, validação de content-type; nenhuma chamada de envio.
- Playwright desktop 1595 e mobile 390: painel real com status sintético 403, seletor de Ferramentas, formulário, feedback, listagem, exclusão, sem overflow ou ação Whatsapp. Screenshots permanecem no Acer (test-results/meli08-ux).
- CI executa `test:mercadolivre-assistido`; typecheck e regressões completas antes de produção.
- Implantar apenas com monitor pausado, backup/hash, sem modificar .env e sem publicar link. Revisão visual de produção read-only após deploy.

## Bloqueio externo ainda não resolvido
A coleta 100% automática de anúncios de terceiros continua bloqueada. O próximo passo não é aumentar privilégios cegamente: abrir consulta de suporte sobre a disponibilidade do endpoint para programa de afiliados e quais recursos oficiais retornam **preço, estoque, vendedor e permalink individual** da oferta para afiliados, incluindo condições de uso. Não desativar 403 nem usar informações insuficientes para envio.

## Pedido objetivo ao suporte oficial
Aplicativo Mercado Livre ativo, scopes do grant coincidem 17/17, GET /users/me, /products/search e /products/{id}/items funcionam. GET /items/{id} retorna 403 access_denied para anúncios de vendedores de terceiros; GET /items/bulk retorna 200 externo/status_code 403 por item. A finalidade é selecionar produtos de terceiros para o Programa de Afiliados e Criadores, não administrar estoque de vendedores. Existe recurso oficial e autorização permitida para consultar preço atual, disponibilidade, reputação e permalink de anúncios elegíveis ao programa? Em caso negativo, qual fluxo documentado deve ser usado para curadoria assistida e geração individual de links? É necessário revisão de IP, perfil de aplicação ou habilitação específica? Não incluir tokens, IDs de usuário nem secrets em tickets.
