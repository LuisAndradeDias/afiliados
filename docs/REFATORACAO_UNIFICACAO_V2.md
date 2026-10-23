# Afiliados 2.0 — primeira etapa da unificação

## O que foi implementado

Uma **Central Unificada de Operação**, sem trocar os motores já usados em produção:

- `http://127.0.0.1:3030/central`: ponto central e novo cockpit responsivo, navegação para ofertas, envio, contatos, campanhas, respostas e segurança.
- `http://127.0.0.1:3030/ofertas`: painel de ofertas original integralmente preservado (também continua disponível em `/`).
- Indicadores reais de ofertas vêm exclusivamente de `GET /api/status` do **próprio** servidor 3030; não são números simulados.
- Links de captação remetem diretamente ao serviço local existente da porta 3045 (ou 3040 quando acessível e detectado). Nada é copiado nem retransmitido pelo frontend unificado.
- A Central de contatos mantém suas URLs originais `/inicio`, `/enviar`, `/contatos`, `/campanhas`, `/respostas-botoes`, `/denuncias` no **servidor dela**. Não houve mudança nas regras de autenticação, consentimento, supressão, filas, WhatsApp Web, WhatyGo ou Netlify.
- Arquivos de apresentação da Central Unificada estão separados em `src/painel/public/central.html`, `central.css` e `central.js`, em vez de ampliar ainda mais o HTML monolítico de ofertas.

## Arquitetura transitória (deliberada)

```text
Browser local
  ├─ http://127.0.0.1:3030/central         (navegação e estado de ofertas)
  ├─ http://127.0.0.1:3030/ofertas          (UI e APIs atuais do motor)
  └─ http://127.0.0.1:3045 ou :3040/...    (Central de contatos; segurança própria)

3030 => Amazon, Mercado Livre, Instagram, revisão WhatsApp de promoções
3045/3040 => consentimento, convites individuais, contatos, filas, respostas, bloqueios
```

**Importante:** este marco entrega uma entrada visual unificada e navegação consistente, **não** uma fusão física dos dois processos nem um frontend SPA único. Fazer um proxy ingênuo para `/api/local/...` seria um risco: a captação exige `Host`, `Origin` e `x-cpv-local` originados de sua própria página e acesso loopback. Esses controles não devem ser contornados. A fusão real dos backends e design system de todas as telas exige uma próxima etapa com testes e migração de cada contrato de API.

## Compatibilidade e segurança

1. Não alterar os diretórios de estado `data/`, `dados/`, arquivos `.env`, sessões Chrome e tokens.
2. Não introduzir PostgreSQL, Cloud API paga, sincronização cloud dos contatos, scraping ou envio sem opt-in.
3. O link do grupo WhatsApp e a mensagem padrão são administrados pelos módulos existentes e devem permanecer armazenados e reutilizáveis.
4. Não publicar `3030`, `3040` ou `3045` na internet, nem modificar os arquivos de rotas públicas de denúncia.
5. Não considerar que o navegador respondeu à tentativa de envio como prova de entrega. Estados incertos precisam de conciliação.
6. Não aplicar esta branch à máquina em uso sem confirmação de regressão, backup local (no disco C:) e rollback.

## Execução (na máquina existente)

1. Instalar dependências existentes com `npm ci`, caso necessário.
2. Iniciar ofertas com `npm run painel`, na raiz do repositório.
3. Iniciar a Central de contatos com o atalho existente `captacao/caca-promos-vip/Abrir Campanhas.cmd` ou script `scripts/abrir-campanhas.ps1`; esse script mantém a política local de diretório de dados e de porta.
4. Abrir `http://127.0.0.1:3030/central`.
5. Em cada tela verificar navegação, contatos autorizados, sessão WhatsApp, grupo salvo, mensagens padrão, oferta pendente, ciclo Amazon/ML, link afiliado oficial e bloqueio de contatos. **Não fazer envio real em testes de interface.**

## Próximos marcos da reforma integral

- **Fase 2 — Design system compartilhado:** tokens de cor, tipografia, espaçamento, tabelas, cards, botões e navegação dos dois painéis. Fazer migração visual incremental dos seis módulos de captação e do painel de ofertas, mantendo seletores de testes legados.
- **Fase 3 — Serviços e contratos:** extrair `src/painel/server.ts` em rotas/adapters/estado; extrair `captacao/.../src/server.mjs` por domínios; mapear contratos de acesso local e escopo de autenticação, criar versionamento de API antes de propor gateway real.
- **Fase 4 — Operação unificada real:** estudar processo/orquestrador único local **sem** duplicar perfis Chrome ou contornar proteção de dados; se aprovado, migrar endpoints de forma testável; nunca proxy transparente inseguro.
- **Fase 5 — QA e rollout:** rodar `npm run typecheck`, `npm run test:painel-operacional`, `npm test --prefix captacao/caca-promos-vip`, testes de navegador Windows (360/390/1440 px), fluxos de OAuth, extensão Meli e WhatsApp com simulação; fazer deploy local gradual e rollback.

## Estado da validação

Alteração criada pelo conector GitHub. O ambiente de execução atual não consegue clonar o GitHub por DNS, portanto **não há garantia de testes executados nem validação do comportamento real na máquina Windows**. Revisar CI no PR e testar localmente antes de merge/deploy.
