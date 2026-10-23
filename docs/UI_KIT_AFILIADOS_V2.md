# Afiliados 2.0 · UI Kit Operacional (Etapa 2)

## Figma

Arquivo editável: https://www.figma.com/design/1PPA925AnmmApIV8fCPfGV

Três páginas, dentro do limite do plano Starter:
1. **Fundamentos e Componentes:** paleta, amostras de tipografia Inter, botões de ação principal/secundária/destrutiva e métrica reutilizável.
2. **Central Desktop:** proposta de navegação por áreas, módulos principais e indicadores.
3. **Central Mobile:** versão de 390px da navegação e principais módulos.

São **propostas de interface**, não capturas de funcionamento real do Windows. Valores exemplificativos nas telas Figma não são dados de produção.

## Fonte visual e estrutura

A fonte principal é **Inter**. A identidade mantém a linguagem já utilizada na Central Unificada: grafite `#172333`, verde `#148a69`, fundo `#f6f8fb`, superfície branca, cinzas neutros e realces de segurança. Não altera qualquer lógica de afiliados, controle do WhatsApp ou autorização de contatos.

- Variáveis Figma: `Afiliados/Primitives`, `Afiliados/Semantic`, `Afiliados/Dimensions`.
- Estilos tipográficos: `Afiliados/display/lg`, `heading/lg`, `heading/md`, `heading/sm`, `body/base`, `body/emphasis`, `body/sm`, `caption`.
- CSS canônico do cockpit: `src/painel/public/central.tokens.css`; importado pelo `central.css` e servido somente pela rota explicitamente permitida `/central/assets/central.tokens.css`.
- Tokens CSS semânticos: `--af-surface-canvas`, `--af-surface-panel`, `--af-brand-primary`, `--af-border-default`, `--af-nav-background`, `--af-status-danger`, etc. Figma liga aliases aos valores primitivos correspondentes.
- Acessibilidade: alvos interativos mínimos de 44px no cockpit, foco visível e redução de movimento conforme preferência do sistema.

## Etapa 3 — Aplicação às telas reais (na branch de revisão)

Esta etapa aplicou a linguagem visual ao **HTML existente**, sem recriar controles ou scripts de operação.

### Central de Ofertas (3030)

- `src/painel/public/ofertas-v2.css` — personalização da tela legada com a paleta semântica, legibilidade, foco, 44px mínimos, responsividade e movimento reduzido;
- `src/painel/public/index.html` — navegação clara para Central Unificada, ciclo, revisão e Instagram; continua com os mesmos IDs, elementos de controle e script principal;
- `src/painel/server.ts` — CSS novo servido apenas por caminho exato na allowlist `/central/assets/ofertas-v2.css`, como os arquivos já utilizados pelo cockpit.

### Central de Captação (3045, com compatibilidade 3040)

- `src/assets/afiliados-v2.tokens.css` — cópia idêntica dos tokens da Central de Ofertas, para que a captação possa continuar funcionando **independentemente**, sem montar um proxy entre portas;
- `src/assets/afiliados-v2.css` — apresentação das seis telas locais: `/inicio`, `/enviar`, `/contatos`, `/campanhas`, `/respostas-botoes` e `/denuncias`;
- `src/layout-clean.mjs` — acrescentados links diretos à Central Unificada e a Ofertas em `127.0.0.1:3030`; navegação interna original, IDs, labels e formulário do envio mantidos;
- `src/server.mjs` — apenas duas rotas de ativos estáticos acrescentadas à allowlist; mesmas regras de segurança `Origin`, `Host`, `x-cpv-local`, sessão local e loopback.
- Rótulos ligados ao antigo computador ACER foram ajustados para **este computador**.

**Os links de 3045 para 3030 são navegação normal do navegador.** Não há requisição `fetch` cruzando portas para contatos, mensagens ou filas. Se o processo 3030 estiver desligado, o link não funcionará até iniciar a Central de Ofertas.

### O que não foi alterado

Motores de Amazon, Mercado Livre, OAuth, extensão, Instagram, WhatsApp Web/Chrome/Playwright, WhatyGo, Netlify, consentimentos, bloqueios, filas, contadores, dados locais, perfis Chrome e mensagem/grupo padrão. Nenhum envio real foi executado durante esta implementação.

## Contrato de design entre os serviços

A fonte dos valores visuais é `src/painel/public/central.tokens.css` e o arquivo autônomo de captação é `captacao/caca-promos-vip/src/assets/afiliados-v2.tokens.css`. O teste `afiliados-v2.test.mjs` exige **igualdade exata entre os dois**; edite ambos ao mudar tokens e mantenha o Figma alinhado.

## Validação e publicação

- CI específica: `.github/workflows/ui-afiliados-v2.yml`, disparada na branch `refactor/unificar-paineis-v2` e nos PRs direcionados à branch de desenvolvimento.
- Contratos do cockpit e Ofertas: `npm run test:central-unificada`.
- Contratos das seis telas, estilos e rotas públicas: `node --test captacao/caca-promos-vip/tests/afiliados-v2.test.mjs`.
- Testes de regressão mais amplos: `npm run typecheck`, `npm run test:painel-operacional`, `npm test --prefix captacao/caca-promos-vip`. Alguns testes usam Chrome no **Windows** e exigem a máquina autorizada.
- Revisão visual obrigatória: 390px e 1440px, foco/contraste, scroll horizontal, botões ativos/desativados, carga do CSS, sessões reais, fluxo de autorização, campanhas e reativação com prova documentada.
- Antes do deploy: fazer backup local de configurações e estado no disco C:, manter rollback para branch atual, verificar CI e testar no Windows, **sem enviar mensagens verdadeiras nos testes de interface**.
- Nada foi instalado nem mesclado automaticamente. **Sem PostgreSQL, sem Remote Desktop Commander e sem API paga obrigatória.**

## Próxima fase

Refatoração estrutural incremental: extrair os blocos grandes de HTML/CSS/JS em módulos reutilizáveis mantendo os identificadores, modularizar servidores Node preservando os contratos de autenticação e fazer teste ponta a ponta em máquina Windows autorizada antes de qualquer fusão real de processos.
