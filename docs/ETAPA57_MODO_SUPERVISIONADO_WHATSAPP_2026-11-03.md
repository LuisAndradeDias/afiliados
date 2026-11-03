# Etapa 57 - WhatsApp supervisionado (03/11/2026)

## Objetivo
Recuperar a operacao original sem API paga: o robo encontra e valida uma oferta, abre o WhatsApp Web no grupo previamente configurado e deixa imagem/legenda prontas. A pessoa realiza **um unico clique manual** no botao **Enviar** do WhatsApp. Nao ha clique automatico do robo nesse modo.

## Configuracao local
- `C:\projeto02\.env`: `WHATSAPP_AUTO_SEND_ENABLED=false` (alterado e copiado em backup criptografado).
- O atraso `WHATSAPP_AUTO_SEND_DELAY_MS` pode continuar ausente; nao interfere com o modo manual.
- A configuracao exige reinicio controlado da Central para entrar em vigor. O monitor de ofertas pode permanecer habilitado; uma oferta salva nao deve ser descartada no reinicio.
- O grupo ja esta salvo em `WHATSAPP_GROUP_NAME`; nao solicitar nome novamente, nem extrair contatos.
- Nao usar API oficial paga ou automacao de contatos em massa.

## Fluxo
1. Monitor Amazon/Mercado Livre gera pacote apos filtros de preco, estoque, cupom, duplicidade e link.
2. O preparador identifica o destino salvo, abre WhatsApp Web, aguarda ate 90 segundos a autenticacao visual e preenche imagem e mensagem, sem clicar em Enviar. Isso evita falhar prematuramente quando o WhatsApp demora para carregar apos abrir o Chrome.
3. Se a oferta ja estava salva antes do reinicio, o botao **Abrir oferta no WhatsApp** permite retomar a preparacao sem exigir homologacao comercial.
4. O usuario confere o destinatario e a oferta e clica em **Enviar** no proprio WhatsApp uma unica vez.
5. O observador `src/robo/whatsapp-envio-observer.ts` compara mensagens de saida com a linha de base; apenas apos evidencia real da oferta enviada registra no historico e sinaliza ao painel para continuar o ciclo.
6. Sem confirmacao, nao registrar enviado, nao limpar oferta e nao repetir o disparo automaticamente.

## Separacao entre preparacao e publicacao
- A preparacao/revisao nao depende do cadastro comercial `elegibilidade-canais.json`.
- As verificacoes de elegibilidade comercial em `src/canais/elegibilidade.ts`, no servidor ao solicitar envio pelo **painel**, e no preparador **antes do clique automatico** continuam intactas. O modo manual dispensa o comando de envio do painel.
- O status comercial `CANAL_NAO_HOMOLOGADO` continua mostrado como pendencia e **nao** constitui uma permissao para automacao de publicacao ou garantia de comissao.
- O botao Enviar do painel permanece indisponivel sem homologacao; o botao Abrir oferta agora fica disponivel para revisar uma oferta ja salva.

## Qualidade verificada
- TypeScript `tsc --noEmit`.
- `tests/painel-operacional.mts`
- `tests/painel-cockpit.mts`
- `tests/painel-cockpit-assets.mts`
- `tests/whatsapp-envio-observer.mts`
- `tests/whatsapp-auto-send.mts`
- `tests/whatsapp-pointer.mts`
- `tests/etapa57-canais.mts` (9 casos)
- Sem WhatsApp real ou mensagem real durante testes.

## Seguranca operacional
- Preservar oferta, perfil do WhatsApp, tokens e historico.
- Nao iniciar disparos automaticos, desativar o clique automatico via variavel de ambiente antes de reiniciar a Central.
- Apos deploy, verificar `/api/status`: `whatsappAutoEnvioAtivo=false`, oferta preservada e conexao/monitor monitorados.
- Nao realizar `git merge` do PR em DRAFT sem homologacao.
