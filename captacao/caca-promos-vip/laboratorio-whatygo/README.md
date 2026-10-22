# Laboratorio WhatyGo (isolado)

## Status
Preparado no ACER. Nao se conecta ao WhatsApp nem envia mensagens automaticamente.
Depende do Docker Desktop (ainda nao instalado quando este laboratorio foi criado).
Fonte: https://github.com/lucasgiovannibr/whatygo
Compose adaptado do docker/instalacao-simples/docker-compose.yml, com uma rede interna,
porta 4000 apenas em loopback, volumes isolados e reinicio automatico desabilitado.

## Antes de executar
1. Instale Docker Desktop para Windows no ACER (pode exigir permissao administrativa,
   WSL 2 e reinicializacao). Nao reinstale o Chrome ou o painel atual.
2. Confirme Docker Desktop aberto: docker compose version
3. Na pasta deste laboratorio, execute: docker compose config -q
4. Execute: docker compose pull
5. Execute: docker compose up -d
6. Verifique: http://127.0.0.1:4000/health
7. Abra http://127.0.0.1:4000/manager e use a chave GLOBAL_API_KEY gerada
   exclusivamente em .env. Nao compartilhe a chave.

## Guardrails
- Use somente CONTA REMETENTE SEPARADA para o laboratorio; nao pareie o numero
  Business de producao nem reutilize perfis Playwright, tokens ou cookies.
- Destinatario de homologacao: numero brasileiro fornecido pelo titular, final 1632.
- Zero envios por API sem clique consciente e aprovacao do numero/conta de teste.
- Enviar no maximo UMA mensagem inicial com botoes e nao repetir se incerto.
- Confirmar recebimento no celular, clicar nos botoes um de cada vez e observar
  eventos BUTTON_CLICK vinculados ao remetente e ao ID originais.
- O clique 'Entrar no grupo' nao adiciona a pessoa sem pedido/confirmacao.
- 'Nao tenho interesse' so altera cadastro mediante verificacao da origem.
- Nunca ativar campanhas ou filas reais neste laboratorio.
- Nunca expor 4000 para a rede ou internet; manter apenas 127.0.0.1.

## Parar
docker compose down
Nao use docker compose down -v: isso apaga volumes com o estado do laboratorio.

## Cuidado
O fork nao oficial tem risco de incompatibilidade e restricao da conta.
HTTP 200 ou ID de mensagem nao prova entrega/renderizacao de botoes.
