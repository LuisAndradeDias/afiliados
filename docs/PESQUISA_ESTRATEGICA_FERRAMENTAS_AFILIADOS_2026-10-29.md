# PESQUISA ESTRATEGICA — Sistemas pagos de automacao para afiliados
## Caça Promos VIP | Benchmark técnico-comercial | 29/10/2026

**Proposta:** aprimorar descoberta, validação, curadoria, cupons,
monetização, mensuração e publicação com evidências oficiais.
**Escopo:** Brasil, Mercado Livre/Shopee/Amazon primeiro; Magalu e
redes de afiliados como expansão. **Estado:** pesquisa e planejamento;
nenhum concorrente contratado e nenhum sistema ativado por esta pesquisa.

## Resumo executivo

O mercado vende sobretudo "achar -> converter link -> criar card -> publicar".
Produtos maduros adicionam garimpo programável, redes de ofertas,
espelhamento, vetorização de textos, cupons, marca d'água, páginas
públicas, múltiplos canais, análises por origem, rastreamento e
programação de filas.

O principal risco é publicar em volume sem comprovar que preço,
vendedor, estoque, cupom, canal e comissão são válidos. O Caça
Promos VIP já tem infraestrutura de painel, descoberta Mercado
Livre, links oficiais via Conector 02, Amazon, Captação, cupons,
WhatsApp supervisionado e controles de pausa. Sua vantagem viável
não é competir apenas em mensagens/hora, mas **curadoria auditável
com poucos falsos positivos**, combinada com mais fontes oficiais,
vitrine própria e dados de performance.

**Ponto crítico atual:** em MLB38053317 a API retornou catálogo
ativo, 32 publicações associadas, sem `buy_box_winner` e sem
quantidade explícita em nenhum dos 32 resultados. Documentação
Mercado Livre: `available_quantity` pode ser reservado ao
vendedor proprietário. Não reinterpretar ausência de estoque
numérico como estoque zero. Ao mesmo tempo, o vencedor mostrado
na PDP pode variar por comprador/localização; associação de item
a catálogo não prova ser o vendedor selecionado na PDP.

**Atenção comercial/contratual:** documentação oficial do Programa
Afiliados Mercado Livre está inconsistente em algumas páginas.
Checklist e FAQ permitem canais WhatsApp/Telegram **públicos**,
mas grupos fechados/privados são vedados; páginas legadas
mencionam WhatsApp/Telegram como proibidos sem exceções.
É necessário confirmar termos atuais da conta e canais declarados
antes de publicar ou assumir comissão. WhatsApp também proíbe
envio automatizado/em massa não autorizado. Evitar mecanismos
de 'anti-ban' que sejam apenas evasão de limites/políticas.

## 1. Método de investigação e confiança das fontes

1. **Documentação oficial de APIs/termos**: alto nível de
   confiança para endpoints, restrições e regras explicitadas,
   respeitando versões, região e elegibilidade.
2. **Página oficial do próprio fornecedor de software**:
   boa evidência de funcionalidades **anunciadas** e preço
   exposto ao público; NÃO prova arquitetura, qualidade da
   coleta, taxas de sucesso ou ROI efetivo.
3. **Documentação de ajuda do fornecedor**: evidência mais
   concreta do fluxo de trabalho e dos filtros configuráveis;
   ainda pode omitir limitações.
4. **Discussões comunitárias**: indícios de problemas e
   prioridades, não amostra representativa nem auditoria
   independente.
5. **Hipóteses e recomendações de engenharia do projeto**:
   propostas para testar, nunca factos alegados de concorrentes.

Todos os preços desta pesquisa foram os exibidos publicamente
em 29/10/2026. Moeda nacional em reais; softwares internacionais
em dólares/euros. Planos e recursos mudam sem aviso. Não
compramos, testamos contas pagas nem acessamos código proprietário.

## 2. Comparativo dos softwares brasileiros

| Ferramenta | Faixa anunciada (mensal) | Diferenciais divulgados | Como parecem captar ofertas | Evidência |
| --- | --- | --- | --- | --- |
| Drope CRM — Afiliados Automático | R$ 49,90 / 99,90 / 199,90 | 4 lojas conforme plano; fontes, regras, fila por peso; extensão; vitrine de cupons; métricas e página pública | Coleta filtrada por loja/categoria/preço/desconto, extensão, rede compartilhada e clone de grupos | https://dropecrm.com/afiliados |
| AffiMetrics | R$ 39,99 / 59,99 / 89,99 | Bot de Garimpo, Bot de Espelhamento, Bot de Disparos, feed Shopee, comissões, páginas e métricas | Open API Shopee conectada e AliExpress; bots buscam em frequência de 1h a 1 dia, filtros por comissão/nota/desconto; espelhamento lê grupos selecionados | https://www.affimetrics.com/support/bot-de-garimpo |
| Ofertiva | A partir de R$ 39,90 | Busca, imagem+texto+link, agenda/manual/auto, espelhamento, página bio | Busca de ofertas e fontes compartilhadas; algoritmo e origem exata não públicos | https://ofertiva.app.br/ |
| Afilira | R$ 47 / 97 / 197 | Fontes/destinos em WhatsApp e Telegram, comunidade de ofertas, garimpo ML, extensão ML, score e prioridade, webhooks em plano alto | Grupos/canais de origem, ofertas comunitárias, garimpo manual ML e extensão; algoritmo privado | https://afilira.com/ |
| Espelha Grupos | R$ 39 / 69 / 99 | Espelhamento, conversão de várias lojas, filas, horários, Telegram, marca d'água, relatórios e Shopee comissão | Espelhamento e garimpo automático em Pro; detalhes de coleta não abertos | https://espelhagrupos.com.br/precos |
| Ofertador Razzio | R$ 21,90 / 37,90 | 4 marketplaces, WhatsApp/Telegram/X, deduplicação, IA, cupons, API e engajamento em Growth | Busca anunciada em marketplaces e conversão; endpoint interno não publicado | https://ofertador.razzio.com.br/ |
| Oferteiro | A partir de R$ 29,90 | Auto/manual/agenda, grupos e comunidades, servidor 24h, Telegram, intervalo | Coleta multi-marketplace, como anuncia; detalhes internos não auditados | https://oferteiro.mgrservicosdigitais.com.br/bot-de-ofertas-whatsapp |
| LucreShop | R$ 29,90 / 59,90 / 95 / 185 / 530 | 4 marketplaces, bot por nicho, campanhas cronometradas, Telegram, Instagram Direct e página | Motor de captura e importação; descrição pública não detalha algoritmo | https://lucreshop.com.br/sobre-a-lucreshop |
| AfiliAI | A partir de R$ 49,90; Combo R$ 99 | Grupos clonados, AutoPilot, multi-canal, card, página, conversão de links | Copia de grupos escolhidos ou coleta própria, sem documentação de API pública | https://afiliai.com.br/ajuda.html |
| Ripply | Valor atual não verificado nesta pesquisa | Auto, biblioteca, vitrine, monitoramento de grupos, remarketing, API comissões, emissão NFS-e Shopee em alguns planos | Busca multi-lojas e grupos monitorados, anunciada pelo próprio site | https://ripply.com.br/ |
| Afiliei | Valor atual não confirmado | Busca multi-marketplace, trocador de links, grupos, fila e horários | Busca anunciada em ML/Shopee/Amazon/Magalu/AliExpress | https://www.afiliei.pro/ |

**Observações relevantes:**
- Preço mínimo é apenas sinal de posicionamento de mercado;
  não implica taxa de sucesso, qualidade de dados ou
  conformidade com termos do WhatsApp/marketplace.
- Alguns fornecedores dizem "validar cupom". Não foi possível
  verificar independentemente se isso significa **aplicação
  real no checkout** ou apenas verificar validade de campanha.
- Sites que anunciam milhões de envios, "anti-banimento" ou
  "comissão garantida" apresentam declarações próprias.
  Não assumir números nem eficácia comprovados.
- Recursos de espelhamento/captação de terceiros devem exigir
  autorização e conformidade; NÃO coletar contatos nem copiar
  mensagens de grupos privados sem permissão.

### 2.1 Drope CRM: fluxo descrito com mais detalhe

O fornecedor descreve **quatro entradas**: (a) fontes de
coleta configuradas por loja/categoria/desconto/preço,
(b) extensão na PDP do Mercado Livre/Shopee,
(c) cópia de grupos selecionados e (d) vitrine
compartilhada de cupons, com importação para fila.
A fila agrega loja, cupom, desconto, recência e regras
de janela/intervalo. O histórico registra origem, regra,
grupo, número, horário e falhas. Há métricas de clicks
na vitrine própria; o próprio fornecedor esclarece que
**comissões são apuradas nos marketplaces**.

O plano Starter anuncia ML apenas e 50 ofertas/dia;
o Pro acrescenta Shopee/Magalu e 300 ofertas/dia;
Master acrescenta Amazon e sem teto de ofertas.
Esses limites são regras comerciais, não sugestão
de enviar 50–300 mensagens diárias no nosso projeto.

Refs:
https://dropecrm.com/afiliados
https://dropecrm.com/afiliados/vitrine
https://dropecrm.com/afiliados/fila
https://dropecrm.com/afiliados/metricas
https://dropecrm.com/precos

### 2.2 AffiMetrics: fonte verificável do bot de garimpo

O manual especifica:
- Shopee ou AliExpress, com conta da loja conectada;
- frequência entre a cada 1 hora e a cada 1 dia;
- escolha de busca por relevância, vendidos, maior comissão,
  preço crescente/decrescente;
- comissão mínima, nota mínima (0–5), desconto ativo;
- opção de loja oficial para Shopee;
- importar direto ou deixar na fila de aprovação;
- um bot de espelhamento por origem de WhatsApp/Telegram;
- no espelhamento, títulos e preços buscados na loja,
  não apenas copiados da mensagem da comunidade;
- ofertas antigas acima de 24h na fila são descartadas;
- anti-loop: grupo de destino de disparo não aparece como
  origem de espelhamento;
- métricas separadas por garimpo, espelhamento, comissões,
  produtos, grupos e páginas.

**Oportunidade aplicável:** separar *candidato descoberto* de
*oferta homologada*, guardar idade da fonte, exigir revisão
quando dados forem incertos e rejeitar autoespelhamento.
O bot de garimpo, por documento, não é motor universal de
API para todas as lojas.

Refs:
https://www.affimetrics.com/support/bot-de-garimpo
https://www.affimetrics.com/support/bot-de-espelhamento
https://www.affimetrics.com/support/metricas
https://www.affimetrics.com/pricing

### 2.3 Afilira, Espelha Grupos, Ofertador Razzio

Recursos úteis a estudar:
- múltiplas origens e destinos com filtros por assunto;
- pontuação e prioridade por loja, descontos e entrega;
- deduplicação entre mensagens e marketplaces;
- conversor que identifica loja e reconstrói link legítimo;
- agendamento em janelas, controle de pendências e histórico;
- indicadores por canal e grupo; API/webhooks;
- Telegram e rede pública de ofertas como destinos independentes.

Não copiar técnicas de aquecimento de números, spoofing,
clonagem de terceiros sem consentimento ou evasão de restrições.
Os termos das plataformas precedem as promessas dos SaaS.

Refs:
https://afilira.com/
https://espelhagrupos.com.br/precos
https://ofertador.razzio.com.br/

## 3. Tecnologias internacionais complementares

### Keepa — o motor de histórico e quedas reais da Amazon

A API oficial de Keepa anuncia:
- histórico de preço por ASIN e marketplace;
- `/deal` com quedas recentes;
- `/product` para histórico e dados de ofertas;
- `/query` com filtros complexos;
- `/bestsellers` por categoria;
- tracking e alertas para ASINs monitorados;
- faturamento por tokens consumidos e plano contratado.

A utilidade no nosso projeto não é copiar preço de tela,
mas responder: "R$ 200 é realmente barato em relação aos
últimos 30/90 dias, ou o preço-base estava inflado?"
Não assumir que a API Keepa está incluída em assinatura
gratuita nem que todos os dados podem ser republicados sob
qualquer licença.

Refs:
https://keepa.com/api-docs/
https://keepa.com/api-docs/plans-tokens.html

### Awin — feeds, cupons e link builder rastreado

Fontes oficiais:
- feed de produtos com nome, imagens, preços, descontos,
  informações adicionais e deeplinks do anunciante;
- Offers API para campanhas e cupons de anunciantes;
- Link Builder API para deeplinks rastreados;
- relatórios de transações, métricas por anunciante e
  campanhas; autenticação, escopos e limites da API.

Essa categoria é muito mais estruturada do que fazer OCR
de mensagens de grupos. Exige participação/aceite nos
programas de anunciantes. Um cupom listado pela rede
não garante aplicabilidade a qualquer SKU/carrinho.

Refs:
https://help.awin.com/developers/docs/product-feed-publisher-guide-intro
https://help.awin.com/apidocs/promotions
https://help.awin.com/apidocs/introduction-to-awins-apis
https://success.awin.com/articles/pt_BR/Knowledge/Publisher-API-Link-Builder

### Lasso, Geniuslink, Affilimate — conversão e performance

- **Lasso:** gestão central de links, alertas de link quebrado
  e produto sem estoque, cards e tabelas de comparação,
  atualização de dados do produto, analytics e localização
  de links. Free, Creator desde US$19/mês, Pro US$29/mês,
  Studio US$59/mês nas telas consultadas; regras de cobrança
  anual devem ser verificadas na contratação.
- **Geniuslink:** localização geográfica, deep links móveis,
  health-monitoring e clique por destino/UTM; cobra em
  função de volume de cliques no plano padrão. A otimização
  internacional é menos importante para nosso foco no Brasil.
- **Affilimate:** consolidação de receitas de múltiplas redes,
  atribuição por conteúdo, canal e link, APIs e análise de
  conversão. Preço personalizado, sem tabela pública confiável.

O aprendizado aqui é uma plataforma de *medição comercial*,
não apenas robô de postagens. Os números efetivos de comissão
devem ser conciliados com relatórios oficiais do marketplace.

Refs:
https://getlasso.co/pricing/
https://getlasso.co/features/dashboard/
https://geniuslink.com/solutions/for-affiliates
https://geniuslink.com/faq
https://affilimate.com/pricing/

## 4. Como as boas ofertas são obtidas na prática

Não há uma origem única. Ferramentas de afiliados combinam
métodos diferentes, cada um com custo, latência e grau de
confiabilidade. A descrição abaixo separa caminhos
documentados de **inferências arquiteturais**.

### Fonte A — API oficial e feeds comerciais

**Mecanismo:** consultar campanhas, produtos e ofertas
autorizadas, paginar resultados, filtrar categoria, preço,
comissão, nota, disponibilidade e data de validade; guardar
proveniência da resposta e cache.

- Shopee Affiliate: há API de listas de ofertas, short links,
  conversões e relatórios validados conforme acesso do programa.
  A documentação oficial do suporte Shopee (Singapura) e
  o Explorer de Open API exemplificam as operações
  `productOfferV2`, `shopeeOfferV2`, `generateShortLink`,
  relatórios. **A disponibilidade exata e as permissões no
  Brasil exigem validação da conta do usuário.**
- Amazon: usar Creators API, sucessora da PA-API 5.
  `SearchItems`, `GetItems`, `GetVariations`,
  `OffersV2` conforme docs e elegibilidade. As docs
  indicam pelo menos 10 vendas qualificadas nos últimos
  30 dias para acesso ao catálogo por API, além de cadastro.
  PA-API 5 foi descontinuada/está retornando 403.
- Mercado Livre: `/products/search`, `/products/{id}`,
  `/products/{id}/items`, `/items/{id}` e consultas de
  preço em contexto, com permissões do app e limitações
  para informação de outros vendedores. **Não existe nesta
  pesquisa prova de uma API pública de afiliado que
  permita substituir o gerador oficial de links do usuário.**
- Awin: feeds e Offers API estruturados por anunciante,
  com link builder apenas quando a relação comercial permite.

**Prós:** campos estruturados, comissão/campanhas quando
permitido, menos parsing, melhor auditoria. **Contras:**
permissões, limite de chamadas, mudança de API, campos
incompletos por perfil de usuário e preços condicionais.

Fontes:
https://help.shopee.sg/portal/10/article/191702-API-Access
https://open-api.affiliate.shopee.co.id/explorer/v2
https://associados.amazon.com.br/creatorsapi/docs/en-us/migrating-to-creatorsapi-from-paapi
https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction
https://developers.mercadolivre.com.br/pt_br/produto-consulta-de-usuarios/buscador-de-produtos
https://help.awin.com/developers/docs/product-feed-publisher-guide-intro

### Fonte B — monitoramento de queda de preço

**Mecanismo:** observar uma sequência de snapshots por SKU
e contexto, detectar mudança relevante e comparar com
mediana/percentis de janelas de 7/30/90 dias; alertar
apenas após revalidação de anúncio e estoque.

O Keepa demonstra esse tipo de fonte com histórico, Deal
e Product Finder. Para Mercado Livre e Shopee, podemos
construir série própria a partir das leituras oficiais
permitidas; ausência de histórico deve aparecer como
"não calculável", nunca "promoção recorde".

**Problema que resolve:** desconto aparente muito grande
baseado em preço anterior inflado. Uma promoção "50% OFF"
pode estar apenas no preço normal do mês.

### Fonte C — vitrines oficiais e campanhas de cupons

**Mecanismo:** consumir campanhas ativas e promoções
de contas/programas autorizados. Registrar código,
janela temporal, restrições de vendedor/produto,
mínimo de compra, primeira compra, meio de pagamento
e elegibilidade da conta.

**Nunca** misturar "cupom aparece numa vitrine" com
"cupom aplicado ao produto e comprador". Cupons
podem ser por quantidade, perfil, região, seller,
marca, financiamento, app ou estoque de resgates.

Drope tem vitrine colaborativa de cupons; Awin oferece
Offers API oficial. São metodologias complementares.

### Fonte D — navegador e extensão com consentimento

**Mecanismo:** operador abre a PDP legítima no Chrome,
a extensão autorizada lê apenas os elementos necessários
do DOM, extrai título, image, preço, oferta, condição
e URL de produto, compara com API e envia para
**fila de revisão**, não diretamente ao grupo.

No projeto, Conector 02 já gera link via portal oficial.
A Etapa 56 acrescenta auditoria do anúncio individual
sem alterar o conector, para manter a origem do vínculo
auditável.

Precauções: não tentar burlar CAPTCHA, login,
restrições de terceiros ou proteção do site; não
reproduzir artificialmente compras; não guardar
cookies/segredos em logs.

### Fonte E — comunidades de ofertas e curadoria humana

Drope, AffiMetrics e Afilira divulgam redes ou importação
de conteúdo de grupos/canais. O AffiMetrics afirma que
atualiza preço e título a partir da loja, ao invés de
confiar integralmente no texto da origem, e descarta
ofertas com mais de 24 horas na fila. Isso é uma boa
**regra de qualidade**, não permissão para copiar
conteúdo de grupos sem autorização.

Uma fonte segura alternativa é receber sugestões de
curadores parceiros autorizados via formulário,
bot ou canal público com permissão explícita.
Cada sugestão vira apenas **candidato**, sujeito à
validação do anunciante, não uma oferta pronta.

### Fonte F — oportunidades por histórico e audiência

**Mecanismo proposto:** a partir das leituras de
interesse e desempenho oficiais por link/etiqueta,
identificar categorias que convertem, horários,
ticket médio e resposta a cupons, e reordenar
candidatos semelhantes.

Sem acesso às comissões oficiais, usar somente cliques
e visualizações — NUNCA afirmar ganho ou ROI real.
O sistema deve prevenir viés de publicar sempre a
mesma categoria apenas porque ela teve mais
exposição historicamente.

## 5. Arquitetura-alvo recomendada

### Cinco conceitos de dados separados

1. `Candidate`: uma pista vinda de API, campanha,
   extensão, editor ou comunidade parceira.
2. `Evidence`: observação datada, marketplace,
   item_id/catalog_product_id, canal, seller_id,
   preço, condição, estoque, cupom e confiabilidade
   por campo, com fonte e TTL.
3. `OfferDecision`: decisão técnica com regra,
   versão, motivos de bloqueio e pontuação,
   aprovada/pending/rejeitada.
4. `Publication`: destino permitido, conteúdo
   efetivamente entregue, status, hora, etiqueta
   oficial e IDs de deduplicação.
5. `Conversion`: evento retornado pela rede oficial,
   com status pendente/aprovado/cancelado, sem
   inferir comissão apenas de cliques.

### Máquina de estados da oportunidade

`descoberta -> enriquecimento -> validacao -> elegibilidade
-> score -> revisao -> aprovada -> programada
-> reverificar -> publicar -> medir -> expirar`

Ramos de erro:
`sem_permissao`, `catalogo_sem_vencedor`,
`estoque_nao_exposto`, `preco_contexto_divergente`,
`cupom_nao_comprovado`, `canal_nao_permitido`,
`link_sem_comissao_comprovada`, `taxa_429`,
`fonte_expirada`, `anuncio_pausado`.

A origem do preço e o momento da leitura precisam
ser atributos obrigatórios para anúncios automáticos.

### Metadados técnicos (proposta)

```ts
type Evidence = {
  source: "official_api" | "official_feed" | "authorized_extension" |
          "human_review" | "approved_community";
  marketplace: "meli" | "amazon" | "shopee" | "magalu";
  catalogId?: string; itemId?: string; sellerId?: string;
  priceCents?: number; currency?: "BRL";
  priceContext?: "marketplace" | "pix" | "card" | "unknown";
  stockStatus: "confirmed" | "not_exposed" | "zero" | "unknown";
  couponStatus: "applied" | "candidate" | "not_applicable" | "unknown";
  capturedAt: string; expiresAt: string;
  evidenceUrlOrHash?: string; sourceVersion: string;
};
type Decision = {
  eligible: boolean;
  blockers: string[];
  confidenceLevel: "verified" | "partial" | "unverified";
  rankScore?: number;
  decisionAt: string; policyVersion: string;
};
```

A persistência deve proteger URLs e dados comerciais
sensíveis: links completos de rastreio, tokens, cookie
ou identificadores de contas não precisam aparecer
em logs públicos. Validar link sem comprar e registrar
somente hash/trilha relevante quando possível.

## 6. Score de oferta: filtrar primeiro, pontuar depois

Um score alto jamais pode compensar ausência de elegibilidade.

### Portão de elegibilidade (hard blockers)

**Todos** os critérios abaixo são obrigatórios para
postagem automática de produtos com preço/comissão:
- anúncio e vínculo de produto verificados;
- marketplace, seller e condição compatíveis com afiliado;
- fonte de preço atual com condição de pagamento explícita,
  ou texto adaptado à condição realmente confirmada;
- evidência suficiente de disponibilidade de compra;
- destino de URL oficial e elegível para link de afiliado;
- canal de publicação declarado, permitido e com consentimento;
- cupom só divulgado se aplicabilidade comprovada ou
  explicitamente indicado como não confirmado;
- sem duplicata recente; sem divergências pendentes;
- respeitar regras de rate limit/termos do marketplace;
- usuário aprova quando a evidência automática é incompleta.

### Score sugerido, experimental (0–100)

Apenas para candidatos que ultrapassaram o portão:
- **25 pontos**: queda real frente a preço mediano 30/90 dias.
- **20 pontos**: precisão e frescor do preço/destino.
- **15 pontos**: adequação da oferta ao público/categoria.
- **10 pontos**: reputação e estabilidade do vendedor.
- **10 pontos**: benefício **comprovado** de cupom válido.
- **10 pontos**: comissão elegível (taxa/ganhos estimados
  apenas quando dados oficiais permitirem).
- **5 pontos**: novidade e variedade vs últimas publicações.
- **5 pontos**: urgência legítima (prazo/estoque com prova).

Pontuação é proposta de trabalho, não ciência validada
ou fórmula usada por concorrentes. Os pesos devem ser
calibrados por conversão **oficial**, cliques elegíveis
e taxa de reclamações/erros, não por volume de postagens.

### Comparação de preço histórico

Guardar `priceCents` por SKU **e por vendedor/contexto**.
Não comparar item da loja X com "preço anterior" da
loja Y, nem Pix com parcelado como se fossem idênticos.

- Mediana 30d/90d para referência robusta;
- menor preço verificado 30d/90d;
- variação e velocidade da queda;
- anomalias de "preço de" excessivamente inflado;
- desvio e volatilidade;
- separar preço do catálogo do preço de canal;
- TTL curto próximo ao momento da publicação;
- marcar "histórico insuficiente" quando não houver dados.

## 7. Motor de cupons: melhoria prioritária

No Caça Promos VIP já há recursos de cupons. Evoluir
para uma **Central de Evidências de Cupons**, evitando
"cupom aleatório com desconto inventado".

Cada cupom deve ter:
- marketplace/campanha/ID oficial (se disponível);
- código, vínculo com item, vendedor, categoria, loja;
- valor fixo ou percentual e teto;
- compra mínima e quantidade por uso;
- forma de pagamento, país/região, primeira compra
  e outras restrições conhecidas;
- início, expiração e momento da última comprovação;
- status: `candidato`, `aplicavel`, `expirado`,
  `incompativel`, `sem_permissao`, `desconhecido`;
- confirmação de aplicação no checkout (quando autorizada),
  sem simular pedido/pagamento.

**Texto de oferta:**
- cupom comprovado e preço final confirmado: informar
  código e condições exatas;
- cupom divulgado mas aplicação não confirmada:
  "cupom sujeito às condições" sem anunciar preço final;
- cupom vencido/incompatível: não incluir;
- erro de API: não assumir cupom ativo.

Combinações de cupons e descontos empilháveis devem
ser verificadas; não somar percentuais aritmeticamente
sem conhecer regras de aplicação da loja.

## 8. Performance, custos e segurança

### Eficiência operacional

- Adotar cache por produto/seller/contexto e TTL por
  categoria/fonte, sem burlar política de uso das APIs.
- Cache de rejeição 403 e 429 com motivo e tempo de reteste
  conforme termos e resposta `Retry-After`.
- Deduplicar entre canais, ofertas e links alternativos;
  preferir fingerprint de produto+item+seller+contexto.
- Usar filas idempotentes, transições auditáveis,
  botão Pausar/Pânico, logs de erro sem segredos.
- Manter apenas arquivos de runtime em diretório discreto,
  backups verificados, GitHub como trilha de código,
  sem poluir disco de trabalho.
- Inicialização automática permanece adiada conforme
  decisão anterior do projeto.

### Indicadores de confiabilidade (mais importantes que volume)

1. `candidatos_por_fonte` e percentual com dados completos;
2. `ofertas_homologadas/candidatos`;
3. divergência de preço e falsos positivos por marketplace;
4. bloqueios por 403, 429, buy box, estoque e cupom;
5. idade mediana da evidência no momento do clique;
6. precisão das alegações de cupom e modalidade;
7. cliques por 100 visualizações nas páginas públicas;
8. comissão **aprovada** por 100 ofertas publicadas
   (apenas com relatório oficial);
9. cancelamentos/devoluções e estornos quando informados;
10. crescimento/saída voluntária da audiência;
11. falhas de link/deeplink e reclamações de preço;
12. custo por oferta validada, não apenas por mensagem.

### Evitar armadilhas

- Não obter contatos de terceiros sem autorização.
- Não tratar grupo fechado como elegível para comissão ML.
- Não reproduzir links de outros afiliados automaticamente
  sem verificar a fonte/autorização e atribuição própria.
- Não gerar cliques/compras para testar comissão.
- Não contratar rotinas "anti-ban" para driblar o WhatsApp.
- Não usar scraper para contornar 403/429 da API oficial.
- Não manter números/comissões de exemplo como dados reais.
- Não prometer que "100% automático" significa "100%
  das ofertas corretas".

## 9. Roadmap de implementação priorizado

| Prioridade | Etapa proposta | Entrega | Critério de aceite |
| --- | --- | --- | --- |
| P0 | 56 — Auditoria direta por item | Consultar um anuncio específico com status/price/seller/vínculo; indicar estoque omitido sem especular | testes mocks + leitura real sem compra nem envio |
| P0 | 57 — Governança dos canais e comissão | Inventário de canais e elegibilidade ML por conta; sinalização publicitária; origens autorizadas | nenhum canal não homologado recebe publicação |
| P0 | 58 — Quadro de revisão / Evidências | Filas "pendente/validada/descartada", motivo e TTL por marketplace | 100% das decisões rastreáveis |
| P1 | 59 — Histórico de preços | Captura oficial 30/90d, mediana, preço mínimo, alerta | nenhuma "oferta histórica" sem histórico |
| P1 | 60 — Cupons avançados | cupom por SKU/loja/conta + expiração e prova | nenhuma economia inventada |
| P1 | 61 — Shopee Affiliate Open API | productOfferV2, short link, subIDs, comissões (se disponível à conta BR) | credenciais próprias + ambiente de teste |
| P1 | 62 — Auditoria Amazon Creators API | elegibilidade, OAuth, OffersV2, fallback correto e cache | sem PA-API5 obsoleta em novo código |
| P1 | 63 — Vitrine pública + Telegram oficial | página de ofertas com filtros e fluxo autorizado de opt-in | publicação segura e tracking verificável |
| P2 | 64 — Medir e aprender | cliques, etiquetas, comissão oficial, ranking calibrado | score melhora métricas sem falhas |
| P2 | 65 — Controle por campanha | regras por perfil, horários e aprovação em lote | sem autopost inesperado |
| P3 | 66 — Multiagente/IA opcional | classificar nicho, gerar texto com dados comprovados | IA nunca inventa preço/benefício |
| Adiada | inicialização automática | serviço em segundo plano, com monitoramento e proteção de máquina corporativa | somente após projeto maduro e aprovação |

### Ordem recomendada e dependências

- Resolver conformidade de canal e identificação de item
  **antes** de aumentar volume de ofertas.
- Criar camada de evidências e revisão; só depois preço
  histórico e cupons, evitando propagar informação incompleta.
- Shopee e Amazon entram como módulos independentes do
  mesmo modelo, com diferentes regras de elegibilidade.
- Analytics e score avançado precisam de dados verdadeiros,
  especialmente comissão validada e não apenas clicks.
- Reavaliar automação/autostart somente após homologação
  de canais, estoques e política de pausas.

## 10. Perguntas que um teste comercial pago deveria responder

Para avaliar um fornecedor sem comprar às cegas:
- Qual endpoint/feed oficial alimenta cada marketplace?
- Há logs de fonte, timestamp e seller do preço?
- Como difere Pix de cartão/conta/região?
- Cupom é realmente aplicado ou só aparece listado?
- O robô bloqueia estoque não comprovado e 403 da API?
- Tem deduplicação entre mesmas ofertas de vendedores?
- Que cadência/TTL de revalidação antes do clique?
- Há evidências auditáveis de links e comissão,
  e suporte a subIDs/etiquetas oficiais?
- Como trata grupo privado em termos de afiliado?
- Como desliga tudo e exclui dados/contatos?
- Suporte a exportação de histórico sem preço enganoso?
- Como recupera falhas sem disparar mensagens em massa?

Sem resposta documental, pontuar recurso como
**anunciado, não tecnicamente demonstrado**.

## 11. Comunidade: sinal de dor, não estatística

Em discussão do Reddit r/MarketingDigitalBR de setembro/outubro
de 2026, um participante relata que mesmo com filtros de
desconto, nota, estoque e blacklist, as ofertas encontradas
pela API seguem genéricas ou repetidas. É relato individual,
não amostra representativa. Serve como alerta para testar
**relevância real e diversidade** além de filtrar percentuais.

Fonte:
https://www.reddit.com/r/MarketingDigitalBR/comments/1wcudec/como_criar_um_grupo_de_ofertas_link_comissionado/

## 12. Restrições oficiais que devem ter precedência

**Mercado Livre Afiliados:**
- produtos novos de vendedores com reputação verde, categorias
  e elegibilidade da conta; links de produto específicos,
  pelo gerador/barra oficiais;
- não criar links para páginas não permitidas, como home,
  categoria, carrinho, página geral de ofertas;
- não usar cliques artificiais nem comprar nos próprios links;
- identificar conteúdo patrocinado/publicidade;
- confirmar canais declarados, públicos e permitidos;
  evitar grupos privados/fechados.
- **Há divergência entre páginas oficiais:** algumas aceitam
  WhatsApp/Telegram públicos, outras ainda listam ambos como
  proibidos. Não presumir direito a comissão sem confirmação
  atual e individual da conta.

**WhatsApp:** políticas proíbem envio em massa automatizado
não autorizado, não há promessa de risco zero de bloqueio
pelo uso de QR/conexões não oficiais.

**Amazon:** respeitar licença do conteúdo de produto,
atualização de preço e API Creators; nada de copiar imagem
e preço sem licença/atribuição aplicável.

**Shopee:** requisitos e tokens da Open API devem ser
obtidos pelo próprio usuário; não herdar API de outro país.

Fontes:
https://www.mercadolivre.com.br/l/afiliados-compartilhamento-de-publicacao
https://www.mercadolivre.com.br/l/checklist
https://www.mercadolivre.com.br/l/afiliados-pode-compartilhar
https://www.mercadolivre.com.br/l/afiliados-paginas-nao-permitidas
https://www.mercadolivre.com.br/l/boas-praticas-links
https://www.mercadolivre.com.br/l/primeiros-passos-perguntas-frequentes-para-afiliados
https://faq.whatsapp.com/5957850900902049/?category=5245250&locale=pt_BR
https://associados.amazon.com.br/help/operating/policies

---

**Conclusão:** nosso produto não precisa vencer os SaaS
por volume de envio. A vantagem sustentável é possuir
um fluxo auditável de origem -> validação -> comissão
elegível -> publicação permitida -> resultado real,
com revisão assistida e canais juridicamente/comercialmente
válidos. O que não pudermos comprovar deve ser exibido
como pendência, nunca convertido em vantagem fictícia.

## Atualizacao de validacao real (29/10/2026)

Etapa 56: GET /items/MLB3771505959 com token autorizado
retornou `403` e foi corretamente classificado
`ANUNCIO_PERMISSAO_NEGADA`. O catálogo
`MLB38053317` continuou ativo sem buy box.
Portanto, **dados externos de anúncio de terceiro
nao devem ser assumidos disponíveis na API
apenas porque a PDP e pública**. Esta limitação
é uma diferença competitiva importante a registrar
no motor de evidências e no painel.

A estratégia recomendada é privilegiar ofertas com
atribuição oficial por item quando autorizadas,
curadoria manual/visual autorizada para revisão
(sem converter automaticamente em comprovação de
comissão), e ampliar fontes oficiais de Shopee,
Amazon e Awin sob os respectivos programas.
Nunca contornar permissões do Mercado Livre.
