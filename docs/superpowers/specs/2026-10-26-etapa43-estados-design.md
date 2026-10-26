# Afiliados 2.0 — Etapa 4.3: temporizadores e transições supervisionadas

**Data:** 2026-10-26. **Base:** PR #40 `refactor/dominios-v2-etapa42`. **Decisão:** refatorar gradualmente, preservando a máquina de envio existente e o estado já salvo.

## Intenção
Separar as decisões de agendamento Amazon/Mercado Livre e as transições da fila WhatsApp em pequenos módulos verificáveis por testes, com ênfase em impedir disparos duplicados ou continuidade automática após cancelamento, quebra do Chrome e tentativas incertas.

## Alternativas consideradas
- **Reescrever motor inteiro e fazer unificação de processos:** alto risco de duplicidade, perda de histórico e quebra de perfis Chrome; rejeitada.
- **Introduzir novos estados persistidos e migrar JSON de filas:** alto risco de compatibilidade com campanhas anteriores; rejeitada.
- **Extrair cálculos puros e um timer de geração exclusiva, mantendo JSON, workers e decisões de envio existentes:** **escolhida**; mudanças pequenas e testáveis, sem migração de dados.

## Contratos

### Central de Ofertas — agendamento
- `calcularAtrasoMonitor({ agoraEm, atrasoSolicitadoMs, proximaLiberacaoEm })`: calcula atraso de pelo menos 500ms, respeitando o próximo instante liberado por histórico; sem sorteios, relógio, rede ou processos dentro da função.
- `criarTemporizadorExclusivo({ agendar, cancelar })`: aceita funções de temporização injetadas; ao desarmar ou remarcar invalida toda callback anterior por geração. Uma execução antiga, mesmo se entregue pelo loop após cancelamento, não poderá disparar o turno. **Não faz monitoramento por si**.
- Integrar sem mudar ações, modo de intervalo, cálculo de quatro por hora, histórico de confirmação e pause manual em `src/painel/server.ts`. Nunca rearmar quando monitor desligado ou histórico não carregado.

### Central de Captação — fila WhatsApp Web
- `proximoStatusTentativaWeb(status, evento, { invalidada })` é pura e aceita eventos `reservar`, `confirmar`, `conciliar-enviado`, `conciliar-nao-enviado`, retornando o status já existente. Confirmar e conciliar requerem `incerto`. Reserva só altera `aberto`→`incerto`; demais permanecem inalterados, mantendo idempotência existente.
- `classificarFalhaWorker({ tentouEnviar, jaPreparou })`, `faseOcupadaWhatsapp(fase, processoAtivo)`, `podeCancelarWhatsapp(fase)` são puras; resultado da falha após preparação/clique é `incerto`, nunca `confirmado`; só permitir cancelar `iniciando/abrindo/pronto`.
- `convites-unicos.mjs` mantém validação de contato autorizado, bloqueios, limite diário 50, persistência atômica, conciliação humana e revalidação a cada ação. Não regravar estrutura de `filas-convites-meta.json`.
- `whatsapp-convite-controller.mjs` mantém lock compartilhado, Chrome Playwright, eventos, envio condicionado a `confirmar:true` e confirmação por evidência do DOM. Não configurar WhatsApp AutoSend.

## Não objetivos
Nenhuma alteração de site, de mensagem padrão, de grupo, da API oficial, de autenticação, de pausa externa, de envio real ou de dados locais. Nenhum deploy/merge automático, alteração Windows, PostgreSQL ou Remote Desktop Commander.

## Aceitação
1. Testes novos começam RED (módulos inexistentes), passam GREEN após extrair funções e integrar.
2. Testes de timer incluem callback antiga depois de cancelar/rearmar; nenhum turno residual.
3. Testes de fila incluem duplicata incerta, confirmação sem clique, conciliação sem confirmação e recuperação persistente após reiniciar, sem dados reais.
4. `npm run typecheck`, intervalos, OAuth, consultas administrativas e suítes existentes de WhatsApp/consentimento e UI passam na CI.
5. CI executa exclusivamente em ambiente temporário sem credenciais; PR em rascunho sobre #40; nenhuma fusão.
