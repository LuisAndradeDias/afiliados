# Afiliados 2.0 — Etapa 4.3: agendamento, filas e estados

**Branch:** `refactor/estados-filase-timers-v2-etapa43`; **base:** PR #40 `refactor/dominios-v2-etapa42`. Somente código revisável, sem deploy e sem execução no Windows.

## Mudanças

### Ofertas — Amazon / Mercado Livre

- `src/painel/dominios/monitor-agendamento.ts` introduz `calcularAtrasoMonitor`, que mantém o atraso mínimo de 500ms e impede ignorar `intervaloCalculado.proximaLiberacaoEm` vindo do histórico de ofertas confirmadas.
- `criarTemporizadorExclusivo` guarda um contador de geração. Toda pausa ou novo agendamento invalida callbacks anteriores, inclusive aquelas já entregues à fila do event loop. A mesma callback não pode executar duas vezes.
- `server.ts` usa essas funções, conservando todos os critérios antigos: monitor ligado, histórico carregado, tarefa concorrente, backoff Mercado Livre, próximo turno, intervalo curto/médio, pausa após 4 envios e limite de 4/hora.
- Nenhuma nova rotina de envio automático foi implementada ou ativada.

### Captação — WhatsApp Web supervisionado

- `src/estados/tentativa-web.mjs` descreve apenas as transições: `aberto → incerto → enviado-manualmente`; após conferência explícita, `incerto → pendente` quando **não enviado**, ou `incerto → ignorado` quando a autorização antiga foi invalidada.
- `convites-unicos.mjs` ainda valida identificação da fila, consentimento atual, bloqueios, limites de 50/dia, impossibilidade de dupla confirmação, persistência atômica e conferência humana antes de conciliar.
- `src/estados/whatsapp-worker.mjs` classifica fechamento/falha do Chrome como `erro` **apenas antes de qualquer preparação**; após preparar ou solicitar clique, resulta em `incerto`, não em `enviado`. O controlador continua aguardando confirmação verdadeira do evento do Chrome.
- `whatsapp-convite-controller.mjs` mantém lock compartilhado entre portas, janela única, confirmação `confirmar:true` antes de enviar e desabilita cancelamento durante envio ou estado incerto.

## Garantias e limites

- Nenhum token, sessão, arquivo JSON de produção, contato, grupo, mensagem padrão ou perfil Playwright foi modificado. O formato `filas-convites-meta.json` é idêntico.
- Nenhuma rota pública/administrativa, cabeçalho Host/Origin/CSRF, API de captação ou callback OAuth mudou.
- Os testes usam dados temporários ou um Chrome **mockado**; nenhum convite real foi enviado. O controle de fila Meta oficial continua o mesmo e não foi habilitado.
- Não há garantia de entrega WhatsApp só porque o campo ficou vazio; o estado continua `incerto` até verificar a conversa.
- O projeto ainda precisa de teste operacional na máquina Windows correta e revisão independente antes do merge.

## Verificação

Workflow: `.github/workflows/refactor-etapa43.yml` com os comandos:

```sh
npx tsx --test tests/monitor-agendamento.mts
node --test captacao/caca-promos-vip/tests/estados-tentativa.test.mjs
node --test captacao/caca-promos-vip/tests/estados-worker.test.mjs
npm run typecheck
npx tsx tests/intervalos-envio.mts
npx tsx --test tests/painel-dominios.mts
node --test captacao/caca-promos-vip/tests/convites-web-manual.test.mjs \
  captacao/caca-promos-vip/tests/whatsapp-incerto.test.mjs \
  captacao/caca-promos-vip/tests/consentimento.test.mjs
node --test captacao/caca-promos-vip/tests/whatsapp-worker-supervisionado.test.mjs
npm run test:central-unificada
```

O teste de Chrome é restrito a worker simulado `CPV_WHATSAPP_MOCK_TEST`. As falhas RED por módulos ausentes foram observadas antes da implementação, e os testes GREEN foram validados pela CI do GitHub Actions. A CI **não** substitui homologação no Windows real.

## Atenção antes de produção

- Um `npm ci` de etapas anteriores relatou **uma vulnerabilidade alta**; a dependência e sua explorabilidade ainda precisam ser auditadas. Não rodar `npm audit fix --force` sem avaliar impacto.
- Persistência de tentativa deve ser revisada sob desligamento abrupto e disco cheio em ambiente temporário; nunca testar esse cenário na fila real.
- PRs empilhados: **#38 → #39 → #40 → PR da Etapa 4.3**. Sem deploy e sem merge automático.

## Rollback

Reverter exclusivamente o PR da Etapa 4.3 restaura o cálculo/agendador anterior em `server.ts` e o controle de status embutido de `convites-unicos.mjs`/`whatsapp-convite-controller.mjs`. Nenhuma migração de JSON é necessária.
