## O que mudou?
Liste telas, arquivos e impacto funcional. Indique explicitamente o que NÃO mudou.

## Base e evidências
- [ ] Branch derivada da main atual, SHA conferido.
- [ ] Tipo de mudança definido: visual, operacional ou ambos.
- [ ] Nenhum dado real, .env, perfil ou motor foi alterado inadvertidamente.
- [ ] Regras 20% / 24h / 120min e confirmação real preservadas.

## Alteração de UX
- [ ] Typecheck e test:ux-contrato aprovados.
- [ ] CI gerou oito capturas sintéticas; comparação visual revisada.
- [ ] Central, Ofertas, Shopee e Revisão abriram em desktop/celular.
- [ ] Nenhum CSS/JS/import 404, erro JavaScript ou rolagem horizontal.
- [ ] Sidebar, topbar e links com geometrias exatas nas quatro telas; o teste negativo de 1px passou.
- [ ] Em Ofertas, status atual, console lateral, filtros, pausa, histórico e drawer com campos originais verificados nas quatro resoluções.
- [ ] Logs e capturas não revelam segredos; nenhum botão de envio ou alteração de configuração é acionado nos testes.
- [ ] Autoenvio no celular, estados vazios e hierarquia de Ofertas inspecionados no navegador.
- [ ] Links, botões, menu, foco e contraste mantidos.
- [ ] Mudança relevante de layout recebeu aprovação humana ANTES de deploy.

## Produção
- [ ] Backup/hash e rollback documentados.
- [ ] Não havia mensagem sendo preparada/enviada.
- [ ] Somente arquivos necessários foram atualizados.
- [ ] URLs, /api/status e interface real foram revalidados após restart.
- [ ] npm run ux:auditar-local concluiu com sucesso; capturas reais ficaram apenas no Acer (não no PR).

**Evidências concretas:** link para execução do CI, imagens sintéticas, commit SHA e ressalvas.
