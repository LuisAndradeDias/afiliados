# Etapa 57 - WhatsApp: painel enxuto e atualizacao sem cache antigo

Data: 03/11/2026. Escopo: UX e entrega de arquivos estaticos, sem envio.

## Pedido do operador

O proprietario pediu para remover o excesso de informacoes de homologacao da aba Publicacao e expressou desejo de usar envio automatico para o grupo existente. A manifestacao do operador nao comprova consentimento de todos os participantes, homologacao nos programas de afiliados nem permissao do WhatsApp para automacao via navegador.

## Implementacao

- Na aba Publicacao, um cartao compacto mostra grupo salvo, sessao tecnica, modo configurado e situacao resumida do canal.
- Foram mantidos os campos e a acao original de alterar o grupo, mas recolhidos por padrao. Nao se pede o grupo novamente.
- Checklists extensos e blocos por marketplace permanecem fora da interface operacional. O backend ainda fornece e aplica elegibilidade por plataforma.
- As rotas HTML `/` e `/ofertas` passaram a informar `Cache-Control: no-store`, evitando HTML antigo apos o proximo reinicio do servidor.
- A interface continua acessivel, responsiva e integrada aos controles existentes.

## Limites preservados

- `src/canais/elegibilidade.ts` e as verificacoes do preparador e servidor permanecem inalterados.
- `WHATSAPP_AUTO_SEND_ENABLED` nao foi ativado: a regra do WhatsApp para autoenvio nao foi comprovada.
- Nenhuma oferta, fila, grupo, credencial, cookie, sessao ou contato foi alterado.
- Nenhum POST de envio real, publicacao, compra ou monitor automatico foi iniciado.
- O fluxo permitido enquanto nao houver homologacao continua sendo a preparacao/revisao sem envio automatico, com divulgacao manual apenas em canais autorizados.

## Verificacoes

- Teste de cockpit headless: estados, navegacao, drawer, modo manual, grupo salvo e mobile, sem POST.
- Teste de rotas visuais: assets e HTML sem cache, rota desconhecida bloqueada.
- TypeScript e `git diff --check`.
- Para implantar: backup com hash; copiar somente arquivos alterados; nao reiniciar a Central com oferta pendente.

## Pendencia para futuras decisoes

Confirmar modalidade do grupo (publico/privado), regras especificas de cada afiliacao e um metodo de publicacao autorizado pelo WhatsApp antes de reconsiderar autoenvio real. A UX nao substitui esta validacao.
