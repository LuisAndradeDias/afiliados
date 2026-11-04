# Recuperação cirúrgica da Central moderna — 04/11/2026

## Fundação e limites

- Base: branch main, SHA 6b0b1b376897a46e2363a2c84bea2fe5300b625e.
- Branch de trabalho: recovery/central-moderna-sem-regressoes.
- Fonte visual: arquivos existentes em C:\projeto02. PR #49 usado só como referência, sem merge.
- Backup local com hashes SHA-256 de 21 arquivos sob %LOCALAPPDATA%\Projeto04\backups\recuperacao-central-20261104-143537.
- Não substituir árvore de produção, pasta data, perfis, arquivos .env ou motor.

## A — Recuperação direta e isolada

- src/painel/rotas-visuais.ts: GET para /, /central, /ofertas, /shopee, /revisao; assets por allowlist.
- src/painel/shopee-http.ts e shopee-rascunhos.ts: rascunhos locais, URLs validadas e mutações restritas a mesma origem; sem API/comissões fictícias.
- central.css, shopee.css, shopee.html, shopee.js: recursos selecionados do Acer.
- Navegação integrada em CSS/JS independentes.

## B — Recuperação com adaptação

- Home: central.html e central.js adaptados aos campos reais do status atual e histórico técnico.
- Cockpit: JS/CSS de leitura, sem mudar botões e handlers originais de /ofertas.
- Revisão: UI técnica desacoplada e endpoint somente leitura GET /api/revisao.
- src/painel/server.ts: três imports e delegação mínima após OAuth/webhook, sem copiar código antigo.
- src/painel/public/index.html: apenas links para scripts e estilos novos.
- Package e CI: novo teste de recuperação integrado.

## C — Não recuperar

Sem retorno da elegibilidade obrigatória antiga, intervalos legados, cotas de categorias, pisos de preço, Instagram, Story/Reel, desconto 25%, cooldown 168h, limites de quatro por hora ou exigências antigas de visibilidade público/privado.

## Contratos imutáveis

- Desconto mínimo 20%; cooldown envio 24h; cooldown prévia 120min.
- Não modificar whatsapp-auto-send.ts, whatsapp-pointer.ts, whatsapp-preparar.ts, whatsapp-envio-observer.ts ou regras-autorizadas.ts.
- Manter os campos whatsappAutoEnvioAtivo, whatsappAutoEnvioDelayMs e a ação whatsapp-auto-send-set.
- Confirmação real no WhatsApp antes de escrever histórico.
- Ajustes locais extras do observer no Acer devem ser preservados.

## Testes

npm run typecheck
npm run test:recuperacao-central
npm run test:recuperacao-visual
npm run test:painel-operacional
npm run test:historico-antiduplicado
npm run test:amazon-preco-dom
npm run test:whatsapp-auto-send
npm run test:whatsapp-pointer
npm run test:whatsapp-observer

## Deploy controlado

1. Verificar /api/status; não reiniciar em preparing, review, sending, oferta preparada ou envio pendente.
2. Exigir testes e CI verdes, merge na main, SHA do merge confirmado.
3. Copiar apenas arquivos modificados do painel e server.ts. Não copiar árvore inteira, motor, data ou .env.
4. Conferir hash da versão original contra backup; abortar em divergência inesperada.
5. Reiniciar apenas o servidor correto da porta 3030, sem abrir WhatsApp nem publicar.
6. Conferir runtime, autoenvio, regras atuais e os caminhos visuais.
7. Em falha, reverter exclusivamente os arquivos do painel a partir do backup.

## Limitações

A revisão mostra registros locais; não comprova estoque, preço atual ou atribuição de comissão. O estado operacaoEstado=error já constava no Acer antes da recuperação e não é corrigido por esta camada visual.
