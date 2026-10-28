# Etapa 50 — Cupons verificaveis e destino de links
Data: 28/10/2026
Status: implementacao supervisionada, sem habilitar envios.

## Objetivo de produto
Adicionar cupons ao Caça Promos VIP sem prometer descontos que dependem
da pessoa, do carrinho, do metodo de pagamento, do estoque e da campanha.
A mesma politica de comprovacao sera usada em Amazon, Mercado Livre e
a futura Shopee. Nao criar links ou cupons artificiais.

## Tres situacoes para cupons
1. **Confirmado**: comprovacao recente no checkout (sem concluir compra)
   daquele produto e anuncio, codigo valido, beneficio e preco final
   conhecidos. Prova expira em 10 minutos. Pode constar da mensagem
   com aviso de que condicoes podem mudar.
2. **Condicionado**: codigo e termos coletados em campanha oficial recente,
   com prazo de validade informado. O codigo pode depender de usuario,
   itens elegiveis, compra minima, valor maximo, quantidade limitada e
   nao cumulatividade. Fica disponivel apenas para analise interna.
   Nao gera preco final/beneficio anunciado, nem pontos no ranking.
3. **Nao verificado**: codigo sem prazo completo, cache velho (mais de
   30 minutos), vencido, fonte sem comprovacao ou checkout antigo.
   Nao entra na mensagem nem no calculo de economia.

A prova de produto exige: cupomValidacao=produto-confirmado,
cupomFonteConfirmacao=checkout, cupomConfirmadoEm recente,
cupomProdutoIdConfirmado e (no ML) cupomAnuncioIdConfirmado iguais
aos da oferta. Apenas um campo "produto-confirmado" isolado nao basta.
A coleta de um codigo publico nunca cria essa prova automaticamente.

## Cupons Mercado Livre
O arquivo src/afiliados/mercadolivre-cupons.ts ja coletava termos oficiais.
Foram corrigidos HTML entities, acentos da leitura de termos, datas,
limite de usos, desconto maximo e "nao cumulativo".
O cache publico local de 06/10/2026 continha 7 codigos antigos; com
a politica nova eles nao sao contados como ativos em 28/10/2026.
Nao restaurar dados antigos nem anunciar um codigo com prazo expirado.
Cupons de afiliados podem ser diferentes dos cupons comuns de campanha;
os termos especificos de cada um ainda precisam de prova.

Fontes publicas de politica:
- https://www.mercadolivre.com.br/l/promocoes
- https://www.mercadolivre.com.br/l/selos-e-cupons
- https://www.mercadolivre.com.br/l/conheca-seus-beneficios

## Barreiras de seguranca implementadas
- src/ofertas/cupons-politica.ts: classificacao e sanitizacao de dados.
- src/ofertas/qualidade.ts e src/ofertas/score.ts: cupons genericos
  nao podem inflar desconto, economia ou ranking.
- src/mensagens/whatsapp.ts: so renderiza codigo e preco quando
  o cupom esta confirmado; nunca imprime candidato.
- src/publicadores/pacote-whatsapp.ts: mantem atributos para
  reevaluar a prova no ultimo instante antes de enviar.
- src/robo/mercadolivre-whatsapp.ts: revalida a campanha e remove
  o cupom sem prova atual, sem afetar o preco normal da oferta.
- src/robo/whatsapp-preparar.ts: barra pacote antigo antes de
  abrir WhatsApp e verifica de novo antes do clique de envio.
- src/painel/server.ts: nao apresenta preco com cupom nao
  confirmado como se fosse oferta aprovada.

Nao existem cupom e preco reduzido garantidos para o catalogo
MLB38053317. O preco com desconto Pix visto em captura de tela
nao eh cupom confirmado.

## Auditoria de destino de link sem compra
O modo tecnico de link pode executar verificacao de destino opcional.
src/afiliados/mercadolivre-destino.ts permite apenas HTTPS HEAD,
sem cookies, com redirecionamentos manuais e lista restrita de
hosts oficiais (meli.la e mercadolivre.com.br/.com). Nunca consulta
dominio externo inesperado, nao baixa pagina nem salva codigo de
afiliado. Rejeita divergencia explicita de catalogo. Se houver
HTTP 403, salto opaco, erro de rede ou ausencia de id, o resultado
eh INCONCLUSIVO, nao sucesso.

O link do programa pode ter uma janela de atribuicao de 24 horas
e depender do ultimo clique valido, entrega e outras regras.
A auditoria de redirecionamento NAO comprova comissao ou atribuicao:
atribuicaoComprovada permanece false ate prova em relatorios oficiais.

Teste tecnico apenas com usuario autorizado, modo pausado e
Conector 02 conectado:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\etapa50\diagnosticar-url-manual.ps1 -ConfirmarTesteManual -VerificarDestino -UrlProduto "URL_COMPLETA_DO_PRODUTO"
Nao executar comando sem uma URL real fornecida e consentimento,
nem com ofertas ou WhatsApp pendentes.

## Proximos objetivos
1. Validar o redirecionamento do proximo link gerado em teste,
   sem guardar dados de afiliado nem abrir carrinho.
2. Habilitar uma revisao manual de cupons com prova de checkout
   que capture produto/anuncio, preco, data e condicoes; nunca
   automatizar compras para provar cupons.
3. Mapear as fontes oficiais de cupons de afiliados do Mercado Livre,
   Amazon e Shopee. Nao supor APIs ou cashback.
4. Somente apos prova real de preco, estoque e link, testar
   um envio supervisionado a contato/grupo autorizado.

Nenhum monitor, envio automatico, WhatsApp ou compra deve ser
ativado por estas alteracoes. O PR #49 segue draft.
