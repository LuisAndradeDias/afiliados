# Etapas 59 a 63 - Maturidade operacional
Data: 2026-11-03. Repositorio: Caça Promos VIP.

## 59. Recuperacao de envio incerto
O preparador abre WhatsApp Web no grupo salvo, gera imagem e legenda e aguarda um clique humano em Enviar.
Se a janela fechar apos a etapa de revisao sem confirmacao do observador, a Central salva `data/envio-incerto-whatsapp.json` (sem grupo, contato, texto ou dados comerciais) e bloqueia a reabertura casual da mesma oferta.
A pessoa precisa verificar na conversa se o envio ocorreu. Se nao ocorreu, o painel oferece **Conferi: NAO foi enviado · Reabrir** e exige confirmacao explicita. Confirmar nao registra um envio; somente permite refazer a preparacao.
Se ocorreu, NAO clicar para reabrir: pendencia continua sem simulacao de historico. Uma etapa futura de reconciliacao com evidencia sera necessaria.
Nunca criar um registro de envio somente porque a pessoa confirmou verbalmente; o historico confirmado depende de prova real no WhatsApp.
Backup das ofertas preservado; nenhuma repeticao automatica.

## 60. Descontos e cupons
Politica permanece rigorosa: cupom identificado numa pagina de promocao nao comprova que se aplica ao produto.
O painel apresenta o total de cupons **observados** e as campanhas potencialmente vigentes separadamente, e continua anunciando cupom em oferta apenas quando comprovado no checkout, para o produto e anuncio corretos, dentro dos 10 minutos de validade da evidencia.
Filtros de preco, vendedor/estoque, desconto, economia minima e links oficiais permanecem intactos.
A Central nao inventa taxas de comissao, vendas ou cupons validos quando nao existem fontes oficiais.

## 61. Metricas verdadeiras
`historicoEnvios` conta exclusivamente registros com `enviadoEm` valido, discriminados por Amazon, Mercado Livre e Shopee.
O painel home mostra esse total, ultima confirmacao, cupons observados e quantidade de campanhas potencialmente ativas. Isso nao implica atribuicao de comissao.
Nenhuma publicacao nao confirmada e contada.

## 62. Shopee pronta para futura conta
Modulo e rascunhos locais existentes foram preservados. O status agora distingue grupo ja configurado, rascunhos totais, API nao conectada e integracao nao pronta.
Mesma Central e futuro mesmo grupo; Shopee NAO esta no monitor nem na fila de envio ate a conta/API e as condicoes de publicacao estarem prontas. Nao copiar cookies ou inserir credenciais ficticias.

## 63. Inicializacao automatica - somente preparada
Script `scripts/launcher/auditar-inicializacao-discreta.ps1` verifica integridade basica do projeto e status da Central, de forma somente leitura.
Nao cria tarefas agendadas, atalhos na Area de Trabalho, chaves de inicializacao, novas pastas no disco C nem janelas de login. Nao reinicia o computador, nao envia mensagens.
A configuracao efetiva de inicializacao automatica permanece reservada para homologacao final depois de validar o fluxo de confirmacao manual e a recuperacao de interrupcoes.
Esta cautela e importante por ser um Acer utilizado no trabalho; a Central nao deve exibir janelas inesperadas.

## Verificacoes de entrega
Executar TypeScript, testes de pendencia persistente, resumo do historico, politica de cupons, painel responsivo, contratos de Shopee e testes de observacao/seletores do WhatsApp.
Aplicar apenas os arquivos necessarios em C:\projeto02 com backup e hashes; reiniciar a Central com os dois arquivos da oferta preservados.
Nao executar envio de oferta, nao presumir homologacao e nao ativar o clique automatico.
