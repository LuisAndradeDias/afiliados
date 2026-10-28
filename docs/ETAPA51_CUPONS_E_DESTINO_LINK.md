# Etapa 51 — validação de destino do link e evolução de cupons

Atualização: 28/10/2026. Planejamento e testes de segurança; não é homologação de cupom real.

## Link Mercado Livre: limite da evidência atual

O Conector 02 v0.4.3 recebeu a URL integral da parafusadeira MLB38053317 e retornou com sucesso um link com formato oficial. O teste técnico não persiste o link. Portanto, ainda NÃO verificamos destino, atribuição de afiliado ou elegibilidade de comissão. Antes de liberar publicação, conferir o destino HTTPS do link com teste supervisionado, sem compra, sem credenciais nos logs e sem assumir que um redirecionamento comprova estoque. A verificação de disponibilidade continua independente.

## Cupons: o que já existe

O projeto já contém os módulos src/afiliados/mercadolivre-cupons.ts e src/ofertas/cupons-politica.ts. A coleta reconhece compra mínima, validade, teto, códigos e não cumulatividade. A aplicação inicial do desconto é ESTIMATIVA. A política de divulgação exige prova de checkout recente e vínculo com o produto e anúncio; cupons não confirmados são removidos do texto público. Não há homologação real de cupom nesta etapa.

## Evolução unificada para Amazon, Mercado Livre e Shopee

1. Inventário de cupons: código, fonte, duração, benefício percentual/fixo, compra mínima, teto, limites de uso, vendedor, categoria, região, pagamento e exclusões.
2. Máquina de estados: descoberto, condicionado, confirmado, expirado, esgotado, incompatível. Um cupom genérico não é automaticamente válido para todos os produtos.
3. Preço: destacar o valor sem cupom. Somente apresentar preço final com cupom quando o checkout permitir comprovar o desconto naquele item, sem realizar compra. Não somar benefícios não cumulativos.
4. Painel discreto: seção de cupons com código, fonte, elegibilidade, prazo, última conferência, motivo de bloqueio e prévia da mensagem.
5. Revalidação antes de preparar e antes de enviar mensagem. Falha de validação remove cupom; se a promoção só valer com o cupom, bloquear a publicação inteira.
6. Instrumentação segura: testes sem credenciais, logs sem dados pessoais, auditoria de alterações e rollback.
7. Homologação por plataforma, depois um único envio supervisionado a destinatário que autorizou contato.

## Regras obrigatórias

- Nunca divulgar cupom expirado ou preço com cupom não confirmado.
- Respeitar compra mínima, teto, não cumulatividade e forma de pagamento.
- Não liberar oferta com estoque desconhecido só porque há cupom.
- Não publicar automaticamente sem homologação e controle de fila.
- Tratar um desconto estimado como estimativa interna, não como promessa ao cliente.

Testes iniciais: tests/etapa51-cupons-politica.mts, quatro cenários unitários sem rede nem WhatsApp.


## 28/10/2026 — ensaio real controlado e reforco incremental

Foi executado no ACER o script `scripts/etapa50/diagnosticar-url-manual.ps1`
com `-ConfirmarTesteManual -VerificarDestino`, usando somente o catalogo
MLB38053317. Todos os criterios de preflight foram satisfeitos.
A extensao respondeu `pending -> running -> done` e gerou uma URL com
formato oficial. O verificador retornou `destinoStatus=inconclusivo`;
a atribuicao de afiliado permanece NAO COMPROVADA.
O script removeu seu proprio job temporario. Nao houve oferta salva,
envio de WhatsApp, compra, ou ativacao dos monitores.

**Sem evidencia de destino real, a Etapa 51 NAO esta homologada.**

A branch de desenvolvimento recebeu reforcos para a proxima auditoria:
- Aceitar o encurtador `meli.la` no host exato, e rejeitar credenciais,
  portas nao padrao e host semelhante na normalizacao inicial do link.
- Validar apenas rotas de catalogo /p/MLB no caminho final esperado,
  evitando confundir rotas artificiais /checkout/.../p/ com produto.
- Quando HEAD nao revela redirect, tentar um GET publico estritamente
  limitado aos hosts autorizados, sem cookies, sem seguir automaticamente
  o redirect, sem ler HTML e sem executar scripts.
- Retornar inconclusivo diante de opacidade, timeout ou bloqueio.
- Informar a categoria estatica do motivo no script diagnostico,
  mantendo URL gerada, query de afiliado e parametros de rastreio fora dos logs.

Estes reforcos ainda precisam de prova real apos atualizacao supervisionada
da instalacao principal. Unitarios com fetch simulado nao provam redirecionamento
real nem comissao. O diagnostico de cupons segue independente.
