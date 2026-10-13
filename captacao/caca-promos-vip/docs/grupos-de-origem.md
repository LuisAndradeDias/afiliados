# Grupos de origem e planilha de interessados

Esta central ajuda a organizar convites **voluntários**, não a extrair participantes de grupos do WhatsApp.

## Procedimento

1. Entre em **Grupos** e cole o link `https://chat.whatsapp.com/...` do grupo do qual você participa.
2. Dê um nome e um código de origem; por exemplo `parceria-tecnologia`.
3. Se o administrador já aprovou sua divulgação, marque **Permissão de divulgação**. Caso contrário, salve sem marcar e obtenha a permissão antes de compartilhar.
4. Clique **Abrir no WhatsApp** para abrir o grupo manualmente com a sua sessão, sem conceder acesso ao aplicativo.
5. Quando houver autorização, clique **Selecionar origem** e use o convite voluntário gerado pela Central.
6. Cada interessado decide se entra no grupo VIP e, separadamente, se autoriza mensagens individuais. Esse cadastro é opcional.
7. Depois de receber `QUERO VIP + código` do próprio titular pelo segundo WhatsApp, confirme a autorização no painel.
8. Clique **Planilha da origem** para baixar somente os registros de interessados dessa campanha, com status e evidência do consentimento.

**Importante:** um convite publicado em grupo de terceiro precisa de permissão do administrador. Estar presente no grupo não constitui consentimento para mensagens comerciais privadas. A central não captura nem enumera participantes, não controla WhatsApp Web e não realiza disparos.

## Segurança

- Lista de grupos: `dados/grupos-origem.json`. Listas de contatos: `dados/contatos-autorizados.json`.
- Esses arquivos e a chave administrativa são locais e ignorados pelo Git.
- As rotas `/api/admin/grupos` e `/api/admin/contatos.csv?origem=...` exigem autenticação. Alterações exigem token de sessão e cabeçalho administrativo.
- A exportação CSV mantém informações sobre origem, pedido voluntário, confirmação, status e descadastro.
- Uma origem pode ser excluída da lista de grupos sem apagar indevidamente o registro de consentimento do titular.
- O link localhost é apenas para testes na máquina. Antes da divulgação pública, configure hospedagem HTTPS com autenticação e segurança adequadas.
- **Nenhuma integração com eSIM ou WhatsApp Cloud API está ativa.** O contato individual só é preparado para destinatários autorizados e precisa ser enviado manualmente.
