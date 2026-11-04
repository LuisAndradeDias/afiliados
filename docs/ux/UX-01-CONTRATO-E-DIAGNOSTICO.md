# Caça Promos VIP — UX-01: estabilização e contrato verificável

> Análise em 04/11/2026. Fase de estabilização; sem alterações na produção.
> Base Git: main 44e3dc949c78389d035aca645f4a0a239352323c.
> Referência visual: Central validada no Acer e capturas inspecionadas em desktop/celular.

## Por que existe esta fase

A implantação anterior mostrou páginas com CSS e contraste quebrados apesar de HTML com HTTP 200. Foi comprovado que central.css importava central.tokens.css, mas a rota para este asset não era servida. O bug foi corrigido; agora a finalidade é transformar esse tipo de regressão em falha de CI **antes** de publicar.

A interface é a camada de operação do motor existente. Uma alteração visual não deve substituir o motor ou mudar regras de promoções.

## 1. Fonte de verdade — não deduzir e não inventar

| Assunto | Evidência necessária | Erro a evitar |
|---|---|---|
| Operação | GET /api/status do servidor correto | Inferir estado pela cor do botão |
| Histórico | Registros persistidos após confirmação real | Contar ofertas preparadas como enviadas |
| Cupons | Observação e validação por produto | Confundir campanha com cupom aplicável |
| Afiliados | Pacote de link validado na fonte | Presumir atribuição ou comissão |
| Shopee | GET /api/shopee/status e rascunhos locais | Declarar API ativa sem credenciais |
| UX | Screenshot real e CSS computado, mais testes | Declarar visual correto só por HTTP 200 |
| GitHub | SHA, PR e resultado efetivo de workflow | Dizer "deploy concluído" por ter feito commit |
| Produção | Backup, hashes, revisão de rotas e navegador | Confundir fixture de CI com runtime do Acer |

Um estado não consultado deve ser reportado como NÃO VERIFICADO.

## 2. Inventário funcional

| Tela | Rota | Tarefa do usuário | Invariantes |
|---|---|---|---|
| Visão geral | / e /central | Ver estado e escolher módulo | Indicadores reais, estilo legível |
| Ofertas | /ofertas | Acompanhar ciclo Amazon/Meli | Botões existentes, monitor, autoenvio e regras preservados |
| Shopee | /shopee | Registrar links e rascunhos | API não presumida, controles funcionando |
| Revisão técnica | /revisao | Inspecionar informações | GET sem alterar dados |

**Achado comprovável no código:** a navegação não é uniforme: sidebar na Visão Geral e Shopee; barra superior nas páginas Ofertas e Revisão. Unificar somente em UX-02, com comparação antes/depois.

**Risco confirmado:** os assets CSS/JS dependem de uma allowlist de rotas. A nova suíte de UX deve abrir todas as rotas reais no navegador para verificar os imports de estilos, e não apenas ler arquivos HTML.

**Hipótese, ainda não validada com o usuário:** termos como "cooldown", "fonte de verdade" e "API" podem ser jargão excessivo na home. Não reformular conteúdo por suposição.

## 3. Identidade visual de referência (não é redesign aprovado)

- Sidebar azul-escuro #172333 e acentos verdes #148a69.
- Fundo #f6f8fb; cartões brancos e bordas discretas.
- Inter/Segoe UI/sans-serif; contraste mínimo de 4,5:1 no menu.
- Botões e navegação legíveis e sem rolagem horizontal nas larguras 390/768/1280/1595 px.
- Foco visível, menu responsivo por botão e tecla Escape.
- Capturas de fixture: 4 áreas (Central, Ofertas, Shopee, Revisão) x desktop/celular = 8 referências de PR.

## 4. Contratos que não devem mudar numa tarefa de UX

- Não editar arquivos do motor src/robo, src/ofertas, fontes, histórico, credenciais, .env ou perfis.
- Grupo do WhatsApp, controle de autoenvio e observador de confirmação real preservados.
- Desconto mínimo 20%; cooldown de envio 24h; prévia 120min.
- Shopee não pode apresentar integração/autosend fictícios.
- Nenhuma auditoria visual pode criar POST, DELETE ou clicar para enviar mensagem.
- Trabalho sempre em branch/worktree, nunca diretamente em C:\projeto02.

## 5. Contrato de qualidade, aprovação e deploy

1. Antes: main e SHA conhecidos, status Git limpo, páginas e arquivos afetados declarados.
2. Durante: uma área coesa por PR; não substituir server.ts antigo ou árvore operacional.
3. Rodar typecheck e regressões do motor, UI em quatro larguras, verificar CSS/JS, navegação, estado, menu, contraste e erros.
4. Subir oito screenshots **sintéticas** como artefatos do CI para inspeção; nunca publicar screenshots de contas/dados reais.
5. **CI verde não equivale a aprovação visual**. Uma pessoa precisa comparar o resultado com a referência e aprovar qualquer mudança relevante.
6. Para deploy: backup por SHA256, runtime sem envio em curso, copiar somente arquivos afetados, revalidar o navegador em produção e manter rollback restrito.
7. Reportar separadamente "alterado na branch", "testado", "mesclado", "implantado" e "validado na tela". Não misturar ambientes.

## 6. Plano UX incremental

- **UX-01 (esta fase):** contrato, teste de navegação/assets, screenshots sintéticas no CI, checklist e auditoria. Sem mudança visual em produção.
- **UX-02:** consolidar componentes, tokens e navegação entre quatro páginas. Apresentar antes/depois e colher revisão.
- **UX-03:** simplificar a jornada de Ofertas, filas e cupons; verificar estados vazios, erros e transições.
- **UX-04:** acessibilidade, responsividade e texto; validar com fluxo real supervisionado, sem mensagem de teste.
- **UX-05:** deploy incremental de alterações aprovadas, com backup e rollback.

## 7. O que o teste não prova

O teste automatizado detecta ausências, regressões estruturais e recursos com erro de carregamento; capturas permitem revisão visual. Não mede satisfação, compreensão dos fluxos nem garante perfeição pixel a pixel. Esses pontos exigem inspeção humana e evidência adicional.

**Definição de pronto de UX-01:** contrato versionado + teste de cinco rotas, quatro larguras, oito imagens sintéticas, nenhum write request, sem recursos quebrados, CI verde.
