# Caça Promos VIP 👑 — Convites pelo seu WhatsApp Web

Painel local de campanhas que reutiliza o **Chrome, Playwright, perfil persistente
e observador de envio** do robô de promoções. Não depende da API paga da Meta,
de um segundo WhatsApp nem de SDKs não oficiais. A automação é **supervisionada,
uma conversa de cada vez**, somente para contatos que consentiram em receber
convites comerciais.

**Acesso no ACER:** http://127.0.0.1:3045/campanhas

Também existe o atalho `Abrir Campanhas.cmd` na pasta oficial
`C:\projeto01\captacao\caca-promos-vip`.
O painel é local (127.0.0.1) e não pede chave de acesso.
As instâncias existentes 3040 e 3045 têm bases de dados privadas distintas.

## Fluxo de envio pelo WhatsApp Web

1. Escreva **uma mensagem única para todos**, salve o link
   `https://chat.whatsapp.com/...` e importe a planilha CSV
   `nome;telefone` da extensão do Chrome.
2. O servidor seleciona apenas **contatos que confirmaram opt-in específico
   para mensagens comerciais**, verifica a lista de bloqueios e elimina
   duplicações. Estar em um grupo de terceiros não equivale a esse consentimento.
3. Clique em **Criar fila para WhatsApp Web**, depois em
   **Preparar conversa**. O painel confere a elegibilidade no servidor e
   abre o Chrome usando o mesmo perfil `data/whatsapp-profile` das promoções.
4. O WhatsApp Web abre a conversa com o número e o texto preenchidos.
   **Confira visualmente nome, telefone e texto**. O programa aguarda sua
   confirmação, não executa envios ao abrir a página.
5. Clique em **Enviar agora pelo WhatsApp** no painel, e confirme o diálogo.
   Isso solicita **um clique único** usando a ferramenta de ponteiro já
   existente no robô de promoções.
6. O observador da conversa verifica se apareceu a mensagem enviada.
   Somente depois dessa detecção o sistema registra o status
   **Enviado** no histórico. Não há repetição automática de clique.
7. Se o WhatsApp fechar, mudar de conversa ou o resultado da tentativa
   não puder ser confirmado, o status fica **Incerto**. Não pressione
   Enviar novamente. Confira a conversa e use no painel:
   **Conferi: foi enviado** ou **Conferi: não foi enviado**.
   A segunda opção exige uma confirmação textual explícita.
8. Se a pessoa responder **SAIR** ou **DENUNCIAR**, registre a reclamação
   na fila. O contato é descadastrado e entra na supressão persistente,
   inclusive após reimportações futuras.
9. Se o WhatsApp estiver ocupado pelo robô de promoções ou o Chrome não
   abrir, desmarque **Usar a automação de Chrome** e utilize a
   alternativa **Abrir conversa no WhatsApp** para enviar manualmente.

A mensagem no WhatsApp Web inclui o link do grupo e a opção de responder
`SAIR` / `DENUNCIAR`. **Botões interativos nativos não estão disponíveis
neste modo gratuito**. O botão de denúncia gera ocorrência interna, não
denúncia oficial ao WhatsApp.

## Limites, duplicações e proteção

- **1 conversa preparada por vez** por controlador local.
- **50 conversas preparadas por dia**, contando no fuso de Brasília,
  inclusive preparações canceladas. O limite é interno, não uma garantia
  contra bloqueio da conta.
- **Zero envios automáticos em lote**: cada destinatário depende de um
  clique explícito do usuário em Enviar agora.
- Verificação de opt-in antes de preparar e novamente imediatamente antes
  de solicitar o clique de envio.
- Persistência do estado `incerto` **antes** de solicitar o clique,
  para evitar duplicações se o programa/Chrome cair.
- Impedimento de segundo convite depois de confirmação, mesmo quando
  o contato aparece novamente em outro CSV.
- O resultado nunca é classificado como enviado apenas pelo retorno
  do botão: exige detecção da mensagem na conversa ou confirmação
  manual específica depois de conferência.
- O controlador não precisa ler senhas, códigos do WhatsApp ou copiar cookies.
  **Evite executar dois automatizadores sobre o mesmo perfil do Chrome**;
  use o modo manual se o robô de promoções já estiver ocupando a sessão.

**Aviso:** controle de velocidade, pausas e uso do WhatsApp Web não garantem
evitar bloqueio. O WhatsApp pode restringir contas por mensagens indesejadas.
O sistema não habilita contatos extraídos de grupos sem opt-in comprovado.

## Dados e código preservados

- `dados/`: cadastro, confirmação de consentimento, denúncias,
  bloqueios, filas, rascunhos e histórico. **Nunca apagar nem publicar.**
- `/c/<origem>`: cadastro voluntário para quem quiser receber ofertas.
- `/sair`: descadastro independente.
- `extensao-lateral/`: leitura supervisionada e exportação CSV.
- A integração preparada para a Cloud API da Meta permanece opcional
  e desativada. Veja [INTEGRACAO_META.md](INTEGRACAO_META.md).

Projeto único: `C:\projeto01`. Não criar worktrees ou pastas de cópia
em `C:\`.

## Testes

```powershell
cd C:\projeto01\captacao\caca-promos-vip
node --test
```

Os testes automatizados usam números fictícios e um Chrome **simulado**.
Nenhuma mensagem real é enviada durante a suíte. A validação visual da
interface do WhatsApp Web real depende de sua autorização para um teste
com destinatário próprio e da disponibilidade da sessão de promoções.
