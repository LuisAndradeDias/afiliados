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

## Escopo atual e limite explícito

Esta etapa **não** aplica automaticamente a nova identidade às seis páginas de captação, nem converte o servidor de ofertas existente de HTML monolítico para um framework. A propagação para essas telas virá após auditoria dos seletores e testes de navegador atuais. Também não instala PostgreSQL, não usa Remote Desktop Commander, não mexe em credenciais/estado local, e não realiza merge na branch principal.

## Validação

Na máquina autorizada, com dependências existentes: `npm run typecheck`, `npm run test:central-unificada`, `npm run test:painel-operacional` e `npm test --prefix captacao/caca-promos-vip`. Conferir contraste real em browser, foco, overflow em 390px e que CSS é carregado de 3030 corretamente. Nenhum envio de WhatsApp real deve fazer parte dos testes visuais.

Próxima etapa: estabilizar componentes e incorporar a nova hierarquia em **todas** as telas de Ofertas e Captação, preservando contratos e IDs dos elementos.
