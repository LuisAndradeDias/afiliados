# MELI-15C — Caçador VIP inteligente (12/11/2026)

## Objetivo e limite desta entrega

O Caçador VIP foi implementado no projeto existente, dedicado exclusivamente ao Mercado Livre. Tem um orquestrador inteligente para decidir quais pautas priorizar, quando consultar e quando interromper, e uma página para analisar rascunhos reais já conferidos pelo operador.

**Motor e painel implementados; busca externa não ativada.** O atendimento 494444122 informou que o Programa de Afiliados não disponibiliza API de busca. A alegação de autorização para robôs ainda depende de conferir a cláusula exata e o escopo referente a anúncios de terceiros e preços. Não transformar uma regra de não sobrecarregar servidores em permissão de coleta.

Não fazer scraping, rotacionar IP/proxy, automatizar página de produto sem licença, contornar HTTP 403, enviar WhatsApp ou publicar ofertas.

## Arquitetura realizada

- src/cacador/meli-orquestrador.ts: orquestrador de consulta por fonte injetada. Controla validação da concessão, orçamento móvel, pausas, memória de preços por ID/vendedor/variante/pagamento, deduplicação e respostas conflitantes. Não chama rede.
- src/cacador/meli-revisao.ts: classifica rascunhos do repositório MELI-09, sem fabricar série histórica.
- src/painel/cacador-meli-http.ts: API LOCAL GET /api/mercadolivre/cacador, somente leitura, no-store, sem dados de credenciais ou link de afiliado no resultado. 405 para outros métodos, 403 para acesso não local, 503 para arquivos corrompidos.
- src/painel/public/cacador-meli.html, .css, .js: interface /cacador, sidebar compartilhada, análise e motivos, filtros, atalhos oficiais para navegação humana. A URL ?demo=1 exibe apenas produtos FICTÍCIOS.
- O botão "Cadastrar produto no MELI" abre diretamente /ofertas#mlAssistDetails. O script existente mercadolivre-assistido.js abre Ferramentas + formulário no drawer da Central, sem enviar ou gerar ações automáticas. O teste Chrome MELI-08 cobre o atalho.
- src/painel/server.ts e src/painel/rotas-visuais.ts: conectam só a rota de leitura e os assets visuais.
- src/painel/public/unified-nav.js: menu do Caçador inserido no shell.
- tests/cacador-meli-motor.mts e tests/cacador-meli-ui.mts: unidade, contrato HTTP, segurança e Chrome em três resoluções.
- package.json e GitHub Actions: scripts/testes e capturas incluídos no CI.

## Política do motor (limites de laboratório, NÃO quotas concedidas)

| Controle | Motor |
|---|---|
| Autorização | Sem concessão expressa, nenhuma chamada |
| Simultaneidade | 1 consulta |
| Intervalo global | mínimo 60 segundos |
| Janela de uma hora | máximo 12 consultas |
| Janela de 24 horas | máximo 60 consultas |
| Tamanho da resposta | máximo 30 produtos |
| Memória | máximo 600 identidades e 20 observações por identidade |
| Mudança relevante | nova pauta após 30 minutos, no mínimo |
| Nenhuma mudança | intervalo dinâmico, até 12 horas |
| HTTP 401/403 | bloqueio sem retry |
| HTTP 429 | pausa mínima de 15 minutos ou Retry-After maior, até 7 dias |
| Falha 5xx/adaptador | espera progressiva sem loop agressivo |
| Autostart e agendador | desativados; nenhum serviço foi instalado |
| WhatsApp/publicação | ausentes do motor; nunca autorizados automaticamente |

A execução da classe é sob demanda e recebe uma fonte já autorizada. Nenhum adaptador de HTTP nem navegador automatizado está conectado. Os limites são hipóteses conservadoras de engenharia; a plataforma poderá impor restrições inferiores ou vedar inteiramente a coleta.

## Análise operacional existente

O módulo MELI-09 já possui dados reais conferidos manualmente. O Caçador os lê sem gerar arquivos novos e os separa em:
- Revisar: conferência recente, ainda depende de vendedor, variante, frete e condições.
- Revalidar: registro com pelo menos quatro horas, preço sujeito a mudança.
- Bloqueado: conferência com 48 horas ou mais, registro comercial vencido.
- Duplicidades: usa a versão mais recente do mesmo URL de produto específico.

Os dois preços registrados no rascunho representam comparação **informada pelo operador**, não um histórico independente confirmado. Todos os candidatos têm podeEnviar=false, podePublicar=false, serieHistoricaVerificada=false e cupomValidado=false.

A lista vazia significa apenas que não há rascunhos locais; não é prova de que a loja esteja sem promoções.

## Próximas dependências para uma caça externa REAL

1. Conferir a cláusula exata do contrato/termo e versão mencionados pelo operador, distinguindo limite de volume de autorização para coleta.
2. Compatibilizar a leitura do termo com a negativa específica do suporte no protocolo 494444122.
3. Se houver licença para uma fonte de dados, desenvolver adaptador exclusivo com auditoria, quotas, revogação e critérios estritos de parada.
4. Executar um canário de uma única consulta real aprovada, validar resposta, preço, estoque, identidade e limites.
5. Homologar a execução recorrente e integrar à Central somente após provas e autorização de envio separada.

**Descoberta autônoma externa: não homologada e não ativada.** O motor e a leitura de rascunhos estão funcionais.

## Testes e rollout

Executar npm run typecheck, npm run test:cacador-meli, npm run test:mercadolivre-assistido, npm run test:meli09, npm run test:ux-contrato e GitHub Actions.

O código está em branch isolada. Não instalar em C:\projeto02 ou iniciar o painel sem backup, verificação de flags de monitores/WhatsApp, prova de CI e plano de reversão. Não habilitar PostgreSQL ou inicialização automática.
