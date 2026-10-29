# UX Lovable incorporada à Central real — 29/10/2026

## Propósito e origem
A intervenção visual desenvolvida no Lovable no projeto **Afiliado AI Central** foi reinterpretada e portada para **Caça Promos VIP 2.0** (Acer, porta 3030), preservando o código de automação existente. O Lovable é uma referência de UX, não o backend/autoridade da instalação real.

## Funcionalidades do Lovable consideradas
- src/styles.css: tema claro, fundo #f6f8fb, azul-marinho #172333, bordas #e3e8ee, branco #ffffff, texto #1b2938, verde #148a69, destaque do menu #285246, foco #61c5a4, Inter/Geist/system, espaçamento e cantos.
- src/routes/_authenticated/route.tsx: menu lateral persistente no desktop, mobile drawer, estado ativo, links navegáveis com altura de 44 px, topbar branca ~70 px.
- src/components/app/ui.tsx: cabeçalhos 28-32 px, cartões claros e métricas 26 px.
- src/routes/index.tsx: home diretamente em painel de métricas, sem tela de login, KPIs com ausência de fonte explicitada e sem valores fictícios.

## Adaptação técnica à aplicação real
- src/painel/public/unified-nav.css: tokens e estilos da experiência, compatíveis com central.tokens.css, aplicados sem regras de automação.
- src/painel/public/unified-nav.js: um único mapa de navegação compartilhado entre Home, Ofertas, Revisão e Shopee; menu responsivo, link ativo, header de estado consultivo e encaminhamento seguro para as rotas já existentes. Não abre o navegador do WhatsApp, não publica e não chama rotas POST.
- A Home / e /central usam o painel real existente. Incluídos cartões com — para Envios confirmados, Cupons ativos e Comissões verificadas, sem fabricar valores: ainda não existe fonte consolidada/homologada para esses KPIs. Os sete indicadores anteriores continuam ligados às APIs locais.
- src/painel/public/index.html, revisao.html, shopee.html, central.html: usam a navegação comum e a mesma identidade; formulários, IDs, seletores e funções dos robôs mantidos.
- src/painel/rotas-visuais.ts: whitelist explícita para servir apenas os dois novos assets. O CSP da página Revisão permite apenas recursos same-origin e os estilos/scripts inline preexistentes, preservando default-src none.

## Limites e decisões
- Sem portar a autenticação/Supabase/RLS do protótipo para o Acer; nenhum login foi acrescentado.
- Nenhum módulo conceitual do protótipo (Radar, Estúdio, Calendário ou Financeiro) foi declarado ativo sem existir no sistema real. Apenas navegação para rotas reais.
- Contatos/campanhas permanecem responsabilidade do serviço separado (portas locais 3045/3040). O menu usa destinos existentes, com fallback para a Central caso esse serviço não responda.
- Não tocar no nome do grupo, WhatsApp, Chrome, Conector 02, credenciais, agendamento, monitores ou rotinas.
- A elegibilidade do canal segue CANAL_NAO_HOMOLOGADO; transferir UX não libera publicações.
- Nenhum crédito adicional do Lovable é necessário para esta migração.

## Verificação
- tests/ux-lovable-transfer.mts: cinco rotas HTTP, novos assets na whitelist, paleta, home de métricas, ausência de formulário de login e CSP de Revisão.
- tests/ux-lovable-visual.mts: Chrome isolado, cinco rotas, resoluções 1330x900 e 390x844, link ativo único, alvos >=44 px, estado do menu, Escape e overflow.
- Suite operacional e visual preexistente, TypeScript e GitHub Actions, antes de implantação.
- Instalação apenas depois da revisão, com backup SHA-256 e rollback. Nenhum envio de teste.

## Próximas melhorias, sem maquiar ausência de dados
- Construir API autorizada de envios confirmados e cupons válidos antes de preencher seus KPIs.
- Integrar relatórios oficiais de comissão quando houver permissão e dados verificáveis.
- Opcional: trilha de navegação entre Central de Contatos e Central de Ofertas sem desproteger dados sensíveis.
