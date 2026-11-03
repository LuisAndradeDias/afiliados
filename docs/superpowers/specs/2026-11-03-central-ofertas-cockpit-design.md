# Central de Ofertas — Cockpit Operacional (03/11/2026)

## Objetivo
Transformar a Central de Ofertas em uma superfície operacional consistente com o design já aprovado: status central claro do trabalho atual; quatro conexões legíveis; operação existente numa coluna principal; terminal tipo CMD e histórico recente em coluna lateral; Configurações próprias acessíveis no topo.

## Restrições obrigatórias
- Sem login, Home permanece Painel de Métricas, navegação lateral atual inalterada.
- Não modificar contratos de /api/status ou /api/action, armazenamento, OAuth, WhatsApp nem regras de segurança.
- Não inventar buscas, envios, comissões, métricas ou conectividade. Usar somente dados da API atual; estados não informados = não verificados.
- Preservar os IDs existentes, ações, formulários, foco no campo editado, imagens e Instagram, progresso, intervalos, fallback manual, relatórios.
- Configuração na aba Contas com os formulários originais; Operação com atalho funcional ao ritmo original; Publicação com nome do grupo original e elegibilidade apenas informativa; Diagnóstico com fallback e controles originais de monitoramento. Sem expor segredos nos logs da UI.
- Terminal lateral com atualização a cada refresh recebido, filtro por fonte, pausa de visualização, rolagem interna. Histórico rotulado como recorte recente dos logs, não persistência completa.
- Desktop e mobile, foco acessível, fechamento Esc/fora do drawer, sem scroll horizontal.
- Autoenvio, monitor e homologação de canal não são habilitados pela reforma.

## Abordagens
1. Reescrever aplicação como SPA: rejeitada, alto risco aos fluxos existentes.
2. Remontar CSS/DOM mantendo IDs e listeners, com assets isolados: escolhida, menor risco e custo de integração.
3. Acrescentar apenas banners sem reorganizar: rejeitada, não resolve configurações e logs.

## Critérios de aceite
- Estado 'offer-pending' + canal pendente mostra "Oferta pendente · envio bloqueado".
- Estado searching + marketplace correto mostra qual fonte está buscando.
- Terminal exibe logs do status real e filtros funcionais sem gerar novas ações; botão pausa congela a visualização.
- Drawer de configurações mantém os inputs atuais funcionais, é acessível, e fecha com Escape; atalhos de ritmo não burlam as ações originais.
- Todos os IDs operacionais originais permanecem exatamente uma vez.
- Testes de navegador da Central e typecheck aprovados, e nenhuma requisição de envio causada pelo novo layout.
