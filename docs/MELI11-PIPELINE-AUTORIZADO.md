# MELI-11 — Pipeline controlado do Histórico Inteligente
Data: 11/11/2026. Branch: feat/meli11-pipeline-autorizado-20261111.

## Estado e limites reais
- O atendimento oficial do Mercado Livre está avaliando o HTTP 403 access_denied para GET /items/{id} de anúncios de terceiros.
- A autenticação OAuth não comprova permissão para consulta de preços de terceiros.
- A documentação técnica oficial recomenda GET /items/{id}/prices para preços em canais/contextos, mas NÃO comprova que nossa aplicação de afiliados esteja autorizada a consultá-los. Nenhuma tentativa a esse endpoint nesta etapa.
- A MELI-11 **não faz requisições ao Mercado Livre**, não renova tokens e não acessa WhatsApp.
- A página padrão /historico-precos lê GET /api/historico-precos e apresenta 0 observações reais até a autorização. Dados fictícios existem APENAS em /historico-precos?demo=1.
- O PR não inclui dados reais, tokens, preços da produção, imagens de terceiros ou scraping.

## Arquitetura construída
- src/historico/meli11.ts: armazenamento SQLite transacional (quando um adaptador autorizado é fornecido), identidade por item/vendedor/variante/pagamento, amostras imutáveis, idempotência, limite 80 observações/turno, máximo 90 dias de retenção e 80 itens x 100 amostras consultáveis.
- PipelineMeli11 permite injetar um adaptador Fonte e um objeto Permissao documental. Ambos e o sinal habilitado precisam estar presentes; se não houver, retorna aguardando_autorizacao/aguardando_fonte e faz zero chamadas externas. O objeto de permissão é uma configuração revisável, não um atestado automático de habilitação pelo Mercado Livre.
- Falhas tratadas sem vazar corpo bruto ou credenciais: 403 trava consultas futuras até nova revisão/instância, 429 pausa até próximo ciclo de pelo menos 30 minutos, erros não alteram dados antigos.
- src/painel/historico-http.ts: GET local somente leitura, no-store; POST devolve 405.
- src/painel/server.ts: integração do endpoint com PipelineMeli11 SEM fonte configurada. Não mexe em monitor alternado, fila, automação ou OAuth.
- src/painel/public/historico-precos.js: fetch somente da API local; atualiza a tela a cada 60 segundos, em modo real. Nenhum preço/estoque é inferido sem observações válidas. Demonstração opcional e separada por URL.
- src/painel/rotas-visuais.ts: CSP limita conexões a same-origin e scripts/styles locais; o código de interface executa somente GET da API local e não possui ação de escrita.
- .gitignore: ignora arquivos *.sqlite e journals para não versionar dados operacionais.

## Regressões e critérios de liberação
- npm run typecheck
- npm run test:meli11 (8 testes de bloqueio, lote, histórico, retenção e 403/429)
- npm run test:meli11-ui (navegador real, três larguras, zero dados reais, demo opt-in, um adaptador sintético injetado)
- npm run test:meli10e-ui (4 larguras) e npm run test:ux-contrato (navegação compartilhada, rodapé/barra)
- npm run test:meli10e, npm run test:meli10, npm run test:historico-antiduplicado
- GitHub Actions da branch deve estar verde antes de merge/implantação. Prints são apenas da interface de ensaio.

## Antes de ligar uma fonte real
1. Receber confirmação expressa do Mercado Livre (escopo, fonte, limites e prazo de armazenamento) para a aplicação e produto de afiliados. Arquivar protocolo sem segredos.
2. Desenvolver/validar um novo adaptador específico para a fonte autorizada; mapeamento explícito de item, vendedor, variante, modalidade de pagamento, moeda e disponibilidade; nunca inferir preço Pix sem contexto.
3. Configurar permissão e retenção após revisão humana, testes em ambiente isolado e backup do banco; medir política de 403/429 e recuperação.
4. Aplicar política de retenção inclusive quando coleta estiver suspensa e eventual revogação da licença (pendência a resolver no adaptador real).
5. Homologar na Central com métricas, logs sanitizados, comparação visual completa, rollback e sem envios automatizados.
6. Só então ativar polling real. Nenhuma integração habilitada apenas por variável de ambiente, sem adaptador compilado e revisado.

Fontes técnicas externas:
https://developers.mercadolivre.com.br/devcenter/api-de-precos
https://developers.mercadolivre.com.br/pt_br/itens-e-buscas
