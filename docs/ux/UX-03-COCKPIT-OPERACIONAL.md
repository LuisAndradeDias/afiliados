# UX-03 — Cockpit, Configurações e Telemetria

Data: 04/11/2026
Base: main 39491a70c41091c4e408804b4cff90df248568b1
Branch: ux/ux03-cockpit-config-terminal

## Problema e evidências

Capturas do usuário revelam espaço inutilizado no cabeçalho, controles e configuração espalhados ao longo de Ofertas, espaço branco na revisão de produto sem imagem, textos de conexão cortados e ausência de uma telinha CMD e histórico próximos da operação.

O PR #49 é exclusivamente referência técnica de arranjo de UX. O próprio PR foi arquivado por conter regras e políticas comerciais não aprovadas. NÃO restaurar o branch, usá-lo como handoff ou mesclar suas regras.

## Implementação

1. Faixa superior grande "CENTRAL EM TEMPO REAL" comunica tarefa concreta a partir de /api/status: buscando Amazon/Mercado Livre, validando link, preparando WhatsApp, oferta pendente, confirmação, monitor aguardando, pausado, última rodada sem oferta ou falha. Não simula envio concluído.
2. Grid desktop: operação original à esquerda, terminal e linha do tempo à direita. Com resoluções menores, tudo se empilha sem cortes ou overflow.
3. Console escuro consome status.logs; filtros Amazon/ML/WhatsApp/Sistema; pausa apenas a VISUALIZAÇÃO e retoma sem alterar processos, fila ou arquivos.
4. Linha do tempo: recorte dos eventos do log atual, claramente rotulado como não sendo o histórico completo. Último envio só é mostrado quando ultimoEnvioConcluidoEm é válido.
5. Drawer "Configurações": Contas e conexões, Monitoramento e Ferramentas. Reutiliza os elementos originais sem cloná-los, preservando todos os campos, ações, formulários, foco e IDs. Escape/fechar/fora da área quando houver backdrop visível.
6. Controle principal de ciclo e autoenvio permanecem acessíveis e inalterados na coluna principal.
7. Regras exibidas somente para leitura: desconto mínimo, cooldown, prévia e slot do motor. Nenhum ritmo de ramo arquivado foi reativado sem endpoint autorizado.
8. Revisão sem imagem compactada, meta vazia oculta, cards de configurações sem estiramento injustificado, conexões sem truncamento. Shopee tem link para consulta, sem afirmar API conectada.
9. O cockpit recebe evento cpv:status emitido na mesma leitura GET de status feita pelo painel original (sem polling duplicado). Uma leitura GET inicial preenche a tela. Erros provocam estado indisponível real.
10. Sanitização por textContent e máscaras preventivas para segredo/token/senha nos logs.

## Restrições

- Sem modificações em server.ts, motor, regras 20%/24h/120min, WhatsApp, grupos, dados, perfis, credenciais, .env e histórico real.
- Jamais criar POST, clicar Enviar ou aplicar novas configurações durante testes de UX.
- Estado bloqueado deve continuar bloqueado; o painel apenas relata a API.
- O refresh não pode sobrescrever input que o usuário está editando.
- A navegação UX-02 deve continuar idêntica em todas as páginas, inclusive 1px.

## Critérios de aceite

- Typecheck, UX-01/02/03, recuperação visual e testes do motor aprovados.
- Teste UX-03 com 4 resoluções: estados, filtros, pausa, drawer, abas, foco, ausencia de POST e captura sintética da tela e configuração.
- Verificação humana de todas as imagens em 1595,1280,768,390.
- CI verde e PR específico. Backup SHA256 de arquivos da produção.
- Deploy apenas de index.html, ofertas-cockpit.css, ofertas-cockpit.js.
- Auditoria local após deploy com GET-only, screenshots privados; hash do motor e .env preservados.

## Fora do escopo

Novas políticas comerciais, mudanças do motor, seleção de ritmo não suportada no backend atual, habilitação de canais, conexão nova e mescla do PR #49 arquivado.
