# MELI-10A — Cupons sem aprovação artificial e diagnóstico da origem real

## Resultado em 09/11/2026
Não foi homologada uma oferta comercial real nesta rodada. A correção entregue elimina uma causa de falso positivo; não desbloqueia a API nem ativa uma fila de publicação.

### Diagnóstico com dados reais
- Central online, Busca média, monitores pausados, zero tarefas/ofertas/envios pendentes; Conector 02 conectado.
- Cache de cupons: 7 registros coletados em 06/10/2026 com validade final em 02/04/2026. Nenhum ativo atualmente.
- Perfil Chrome automatizado do projeto: /afiliados e /cupons retornaram HTTP 200 da tela de login /login/identification, com zero produtos. A captura mostrou pedido de e-mail/telefone, não uma coleção de ofertas.
- Chrome habitual: janela com título Central de afiliados e criadores e endereço /afiliados/hub. Captura via PrintWindow não renderizou o conteúdo; a interface de acessibilidade não disponibilizou documento. Não foi possível homologar os produtos dessa sessão, nem inferir logout. Não houve cópia de cookies/credenciais ou reinício do Chrome habitual.
- API: token expirado renovado pelo mecanismo OAuth já existente. Isso atualizou o token/refresh/validade na .env; não mudou escopos ou configurações comerciais. Cinco GETs: identidade 200, catálogo 200 (3 produtos), competição 404 e 200, detalhe de anúncio 403 access_denied. Consulta interrompida no primeiro 403, sem varredura insistente.
- Evidências reais ficam apenas em %LOCALAPPDATA%/Projeto04/previews/meli10-origem; não subir capturas de conta ao GitHub.

## Defeitos reproduzidos e corrigidos
1. Produto de R$100 por R$90 (10%) + cupom hipotético de 30% resultava em descontoEfetivoPercentual=37 e podia ultrapassar o filtro de 20%, embora a aplicabilidade do cupom não tivesse sido confirmada.
2. Agora descontoEfetivoPercentual permanece 10; descontoComCupomEstimadoPercentual=37 e precoComCupomEstimado=63 são apenas hipóteses condicionais, nunca aprovação. O score MELI não ganha bônus de cupom não confirmado; Amazon/Shopee mantêm sua lógica anterior.
3. Cupom sem validade final explícita, vencido, data inválida/futura, coleta antiga ou benefício numérico inválido não é considerado vigente/utilizável. A janela de coleta utiliza a configuração existente (padrão 10 min); não é garantia de quota ou aplicabilidade.
4. Datas de calendário impossíveis são recusadas; preço estimado é arredondado para centavos. Compra mínima, teto e não cumulatividade continuam respeitados na simulação.
5. Quando a página pública falha, observações válidas e recentes do navegador ainda são consideradas. Não há fallback para cupom antigo sem limite de idade.
6. Observações exigem origem HTTPS do domínio oficial; fonte persistida remove query para não guardar identificadores de navegação.

## Testes
- Teste RED anterior à correção reproduziu 37!=10, centavos extras, 31/02 aceito e perda de observação por HTTP 403 simulado.
- 16 testes unitários/integração de cupom passaram com código real e arquivos temporários, rede externa substituída somente no teste.
- Preview completo em processo isolado: desconto base 10% + cupom estimado -> exit2 sem oferta; base25% -> exit0 com cupom apenas condicional. Nenhum pacote de WhatsApp criado.
- Não confundir esses cenários sintéticos com ofertas reais descobertas.
- CI executa test:meli10 além das regressões existentes.

## Revisão
Revisão de diff pelo próprio implementador (sem agente independente disponível). Escopo mantido em validade, frescor e separação entre hipótese/aprovação. Não houve alteração de interface, envio, permissões de canal, buscas média/longa ou critérios 20% / 24h / 120min.

## Próximas etapas propostas, ainda não implementadas
- Homologar leitura do portal autenticado com o perfil correto ou observação autorizada pelo Conector 02; distinguir login, acesso negado, vazio e sucesso.
- Persistir candidatos separados da fila de envio, deduplicar por anúncio/variante, registrar fonte/data/motivos e histórico real de preço.
- Revalidar item, vendedor, cupom e destino antes da reserva e do envio; expirar itens antigos; nunca promover candidato por hipótese de cupom.
- Consultas contínuas com worker único, orçamentos, pausas e circuit breaker por fonte, sem reutilizar busca bloqueada a cada segundo.
- Escolher primeiro o preço/condição realmente bom; comissão e desconto nominal sozinhos não provam boa oferta.
- O callback Cloudflare temporário continua pendência separada de estabilidade; não foram criados novos túneis nesta etapa.

Plano completo: docs/superpowers/plans/2026-11-09-meli10-cupons-e-fila.md.
