# Caça Promos VIP — instruções obrigatórias para agentes de manutenção

Leia docs/ux/UX-01-CONTRATO-E-DIAGNOSTICO.md e docs/ux/UX-02-ESTRUTURA-UNIFICADA.md antes de alterar a UX.

## Anti-regressão / anti-alucinação

- NUNCA afirmar que algo foi publicado, aprovado, enviado, configurado ou testado sem evidência específica.
- Separar observação, hipótese, teste em ambiente fictício e verificação do Acer.
- Não inferir estados a partir de texto de interface; usar a API real.
- Não substituir motor, server.ts integral de branch antiga, .env, data, perfis ou histórico.
- Preservar descontos 20%, cooldown 24h, prévia 120min, autoenvio e confirmação real.
- UX em worktree/branch isolada; alteração pequena por PR. Não introduzir mudanças operacionais disfarçadas.
- Rodar typecheck, test:ux-contrato e regressões do motor. Conferir screenshots sintéticas em desktop/celular.
- CI verde não é aprovação do design. Obter revisão humana para mudança visual relevante.
- Nunca usar mensagem real, WhatsApp ou POST/DELETE como parte de um teste visual.
- Produção em C:\projeto02 não é checkout Git; pode diferir da main. Backup/hash antes de atualizar.
- Após deploy, rodar npm run ux:auditar-local; o comando só consulta localhost:3030 e guarda evidências privadas em AppData.
- Se houver falha, rollback apenas de arquivos que foram efetivamente modificados.
- Comunicar etapa exata: branch, teste, CI, merge, deploy e verificação visual — não pular níveis.

## REGRA VISUAL NÃO NEGOCIÁVEL — aplicar SEMPRE, inclusive alteração de 1px

- Antes de qualquer edição de UX, capturar e INSPECIONAR a aparência atual da Central, Ofertas, Shopee e Revisão em desktop e celular.
- Depois de cada alteração que possa afetar layout, fontes, espaçamento, alinhamento, cores, navegação ou texto, renderizar novamente TODAS as áreas afetadas. Comparar visualmente antes/depois. NÃO aprovar apenas por HTTP 200, testes unitários, TypeScript ou assertivas sem screenshot.
- Rodar npm run test:ux-contrato (inclui ux-shell-pixel.mts) em cada PR com CSS/HTML/JS visual. O teste exige posição e dimensões exatas, estilo computado consistente e verifica deslocamento proposital de 1px. Um único pixel de diferença nas coordenadas estruturais reprova a mudança.
- Usar 1595, 1280, 768 e 390px como resoluções de verificação, verificar scrollbar, menu móvel, foco, estados vazios, textos truncados e recursos de CSS/JS ausentes.
- O teste de bitmap tolera apenas variação de rasterização de fonte entre documentos (até 5%), **nunca** deslocamento real, CSS divergente ou diferença em dimensões.
- Revisar as capturas de CI com dados sintéticos e as capturas reais locais após deploy. Capturas reais do Acer nunca devem ser anexadas a GitHub nem conter dados privados publicados.
- NÃO fazer merge nem deploy de alteração visual se algum teste de navegação/pixel/asset falhar ou se a captura exibir desalinhamento. Corrigir primeiro, repetir a rodada inteira e guardar evidências.
- Se uma mudança parecer exigir reescrever o motor ou restaurar versão antiga inteira, PARAR e isolar a mudança visual. Não tocar no autoenvio, WhatsApp, contas, cupons ou regras.
- Declaração de conclusão de UX deve indicar as telas e resoluções realmente vistas, resultados, problemas encontrados/corrigidos e pendências. Não afirmar "pixel perfeito" sem teste objetivo.
