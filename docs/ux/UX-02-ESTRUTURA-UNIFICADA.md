# UX-02 — Navegação unificada e hierarquia operacional

Data: 04/11/2026
Base: main 8a6cbbcce9e9ab3c177ea491146000049678b267
Branch: ux/etapa02-navegacao-visual-unificada

## Problema comprovado

- Visão Geral e Shopee tinham duas sidebars independentes, com links e rodapés diferentes.
- Ofertas e Revisão possuíam barra horizontal inserida por JavaScript.
- Quatro telas tinham cabeçalhos, paddings e critérios de responsividade diferentes.
- O diagnóstico auxiliar de Ofertas aparecia antes do controle principal.
- Em 390px a caixa de autoenvio espremia o texto contra o botão.

## Solução implementada

1. Um único componente de navegação: unified-nav.js gera quatro entradas, substitui menus legados e não duplica handlers.
2. Uma fonte de estilos: unified-nav.css define sidebar, cabeçalho, estados e responsividade em todas as rotas.
3. Alinhamento exato: sidebar x=0, largura 252px em desktop; topbar x=252 e altura 78px. Em largura <=860px, topbar tem altura 70px e menu overlay.
4. Ofertas mais diretas: controle principal em primeiro lugar, depois conexões/atividade, revisão e só depois diagnóstico auxiliar. IDs e ações originais foram preservados.
5. Mobile: autoenvio em layout empilhado, botão largura total, texto legível.
6. Revisão: mesmo fundo e hierarquia de cabeçalho das demais áreas.
7. Estados honestos: barra superior consulta /api/status por GET e exibe estado real ou indisponibilidade, sem publicar nada.

## Fonte de verdade e segurança

Modificar apenas recursos visuais em src/painel/public, docs e testes. Não alterar server.ts, src/robo, src/ofertas, histórico, cupons, autenticação, .env, data ou perfis. Contratos 20% / 24h / 120min e confirmação real de envio preservados.

## Barreira visual objetiva

tests/ux-shell-pixel.mts:
- quatro telas e quatro larguras: 1595, 1280, 768 e 390px;
- geometria igual de sidebar, links e topbar, sem tolerância de 1px;
- propriedades CSS computadas iguais após normalizar a seleção de página;
- screenshot com até 3% de tolerância só para rasterização de fontes entre documentos no Chromium;
- controle negativo: left:1px deve ser detectado na geometria E imagem;
- menu móvel abre e fecha com Escape; nenhuma escrita no backend.

npm run test:ux-contrato inclui a suíte de pixels, o teste de assets CSS/JS e oito capturas sintéticas de CI. Estas imagens são evidência para inspeção humana, não autorização automática de um redesign.

## Gate de deploy

- Inspecionar capturas antes/depois das quatro áreas em desktop e celular.
- TypeScript, UX-01/02, testes WhatsApp/cursor/observador/histórico verdes.
- CI verde, PR revisado e merge na main identificado por SHA.
- Verificar runtime sem oferta/envio pendente e sem processos ativos.
- Backup por SHA256, copiar apenas recursos visuais afetados.
- Reiniciar somente o servidor da porta 3030, validar cinco rotas e executar npm run ux:auditar-local.
- Preservar parâmetros de autoenvio, destino, dados e regras. Não disparar mensagens para testar UX.

## Escopo dos testes

A precisão geométrica detecta qualquer deslocamento de 1px; variação de antialias entre documentos não é um deslocamento. A aprovação final também exige inspeção da captura renderizada, pois testes não garantem perfeição estética.
