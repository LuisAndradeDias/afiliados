# Caça Promos VIP — instruções obrigatórias para agentes de manutenção

Leia docs/ux/UX-01-CONTRATO-E-DIAGNOSTICO.md antes de alterar a UX.

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
- Se houver falha, rollback apenas de arquivos que foram efetivamente modificados.
- Comunicar etapa exata: branch, teste, CI, merge, deploy e verificação visual — não pular níveis.
