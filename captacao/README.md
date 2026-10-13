# Caça Promos VIP — Captação voluntária

Este diretório guarda um sistema **separado** do robô de ofertas em C:\projeto01.
A aplicação fica em captacao/caca-promos-vip/, com porta local 3040.

A pasta dados/ da aplicação contém métricas, chaves e eventuais contatos e
é ignorada pelo Git. **Nunca inclua contatos ou chaves no GitHub.**

## Funcionalidades (v0.2)
- Links de campanha por origem e páginas de adesão voluntária
- Convite para o grupo VIP sem exigir telefone
- Formulário opt-in para mensagens individuais, com termo registrado
- Verificação manual de código enviado espontaneamente ao segundo WhatsApp
- Painel privado para revisar, autorizar, descadastrar e excluir contatos
- Exportação de CSV e modelo de planilha Excel
- Preparação de mensagens individuais para envio **manual** pelo segundo número

Não coleta os telefones dos participantes de grupos de terceiros e não dispara
mensagens automaticamente. Para divulgação em terceiros, obtenha autorização
do administrador do grupo. Para hospedar publicamente é necessário HTTPS,
autenticação e revisão de proteção de dados; localhost só funciona na máquina.

## Abrir no computador Luis
1. Dê dois cliques em "Caca Promos VIP - Central de Contatos" na Área de Trabalho.
2. Acesse http://127.0.0.1:3040/painel.
3. O link local de convite é http://127.0.0.1:3040/c/instagram.
4. Configure o segundo número no painel, antes de preparar mensagens.

Para testar sem envio: cd captacao\caca-promos-vip e npm test.
Veja o README dentro da aplicação para detalhes completos.
