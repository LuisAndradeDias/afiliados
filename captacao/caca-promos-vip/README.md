# Caça Promos VIP 👑 — Convites pelo seu WhatsApp Web

Painel local de campanhas que reutiliza o **Chrome, Playwright, perfil persistente
e observador de envio** do robô de promoções. Não depende da API paga da Meta,
de um segundo WhatsApp nem de SDKs não oficiais. A automação é **supervisionada,
uma conversa de cada vez**, somente para contatos que consentiram em receber
convites comerciais.

**Acesso no ACER:** http://127.0.0.1:3045/inicio

## Se a mensagem desaparecer ao clicar em Enviar ou Enter

- O texto do convite fica preservado em **Enviar convite → Copiar mensagem**.
- O Chrome abre **somente a conversa**, sem inserir o texto por parâmetro
  de URL. A mensagem é preenchida depois de a conversa carregar, e o
  observador de mensagens enviadas é armado ANTES disso.
- O painel acompanha o WhatsApp mesmo quando você clica diretamente no
  navegador ou usa Enter. Só registra envio confirmado ao detectar uma
  nova mensagem de saída contendo referência ao convite.
- Se o campo ficar vazio e não surgir uma mensagem de saída confirmada,
  o painel mostra **Resultado incerto**. Essa tentativa não pode ser
  repetida até você conferir o histórico no WhatsApp e conciliá-la em
  **Listas e filas**. Campo vazio **não prova envio**.
- Não clique repetidamente para tentar compensar desaparecimento de
  texto. Verifique primeiro o WhatsApp e, se necessário, copie o convite
  salvo no painel. Nenhuma rotina fará uma segunda tentativa sozinha.
- Para instalar esta correção na porta 3045, depois de conferir o resultado
  da tentativa atual e fechar a janela controlada do WhatsApp, execute
  `Aplicar correcao WhatsApp.cmd` na pasta do projeto no **disco C:**.
  O atalho **se recusa a reiniciar** se houver conversa ativa, cria backup
  privado com verificação SHA-256 e nunca clica em Enviar.

## Enviar um convite para o meu próprio número (novo)

**Página simples:** http://127.0.0.1:3045/enviar

1. Escolha **Enviar para mim**, digite seu WhatsApp brasileiro com DDD e
   clique em **Verificar número**. O sistema procura a autorização existente.
   Caso não esteja cadastrado, você poderá informar seu nome e declarar que
   é o titular do número e autorizou o teste; **isso não envia mensagem**.
2. Se o número aparecer como bloqueado ou descadastrado, ele não poderá ser
   incluído por essa tela. Abra **Contatos → Bloqueados → Ver ficha →
   Desbloquear contato**, com uma nova autorização documentada. Volte a
   **Enviar convite** depois.
3. Clique em **Continuar**. A etapa **Confira antes de preparar** já abre
   com a mensagem e o link do grupo previamente salvos, mesmo se a consulta
   pelo navegador falhar ou se a página for atualizada. Você pode editar
   o texto; **Restaurar padrão** recupera os dois campos da última versão
   salva e solicita confirmação antes de substituir edições não salvas.
   Ao clicar em **Salvar e preparar 1 convite**, a mensagem editada passa
   a ser o novo modelo salvo para próximos convites.
   Confira/edite a mensagem e o link do grupo,
   depois **Salvar e preparar 1 convite**. O sistema registra um convite
   para esse único destinatário; **ainda não envia**.
4. Clique em **1. Abrir conversa no Chrome**. Se precisar conectar o WhatsApp,
   use o painel expansível de conexão, escaneie o QR e **Salve sessão e feche**
   antes de preparar.
5. Confira número e mensagem no Chrome. Só então clique em
   **2. Confirmar e enviar esta mensagem**. O registro de envio exige
   confirmação efetiva no WhatsApp. Há uma alternativa manual disponível,
   com declaração de envio somente após sua realização.

**Para outra pessoa autorizada**, escolha **Outro contato**, pesquise o nome
ou os últimos quatro dígitos, selecione a pessoa e siga os mesmos passos.
A tela mostra apenas contatos autorizados. Não há envio em massa automático.

**Onde estão as listas e filas?** Em `/campanhas`, agora chamado
**Listas e filas** (área avançada). Uma fila é somente a sequência/histórico
de convites: o envio individual cria e controla essa fila sem exigir que você
importe CSV ou navegue pelos detalhes. Tentativas incertas não são reenviadas
automaticamente e exigem conferência manual. Uma reautorização verdadeira
permite um NOVO convite, sem reabrir campanhas antigas.

## Central de gestão — experiência reorganizada

O painel está dividido em **cinco áreas com navegação fixa**:

1. **Visão geral** (`/inicio`): resumo de contatos, bloqueios e situações.
2. **Enviar convite** (`/enviar`): caminho principal para testar no seu
   número ou escolher uma pessoa, sem planilha, com confirmação de envio.
3. **Contatos** (`/contatos`): cadastro, autorizações, descadastros e
   desbloqueio documentado.
4. **Listas e filas** (`/campanhas`): ferramentas avançadas para importação
   de CSV, campanhas com vários destinatários, modelos e histórico.
5. **Denúncias** (`/denuncias`): histórico de reclamações, pedidos de saída
   e sincronização Netlify.

### Segurança e bloqueios

- `Bloqueado` corresponde a uma denúncia interna recebida, um pedido de
  saída persistente ou um **bloqueio administrativo**.
- `Descadastrado` é um contato removido do envio sem um bloqueio por hash
  persistente. As categorias da lista são mutuamente exclusivas.
- **Bloquear novos convites** na ficha exige confirmação e deixa uma marca
  administrativa — **não fabrica denúncia** do destinatário. O bloqueio
  persiste mesmo após importar novamente o número.
- **Desbloquear contato**: em `/contatos?filtro=bloqueado`, abra
  **Ver ficha → Desbloquear contato**. É necessário documentar uma
  **nova autorização do titular** (origem, data posterior ao bloqueio e
  referência verificável), marcar a confirmação e confirmar a ação.
  Apenas o cadastro escolhido é reativado. O histórico original da
  reclamação não é apagado; uma nova ocorrência de **Reativação com
  nova autorização** é acrescentada à auditoria.
- A operação verifica primeiro pedidos pendentes no Netlify e recusa a
  liberação se não conseguir sincronizar. Filas antigas sem tentativa
  são encerradas, e tentativas incertas não podem ser retomadas como
  pendentes. Nenhuma mensagem é enviada ao desbloquear; o operador deve
  iniciar **uma fila nova**, e o envio segue supervisionado.
- Se a pessoa voltar a clicar em **Não tenho interesse**, inclusive no
  mesmo link antigo após a reativação, um novo pedido de saída será
  respeitado. O bloqueio voltará a valer normalmente.
- Não existe desbloqueio em massa ou automático. Não utilize esse
  botão sem nova permissão expressa (ou, para um teste seu,
  confirmação de que você é o titular e autoriza novos convites).
- Os endpoints da Central ficam em `127.0.0.1`; não são publicados pelo
  Netlify. Números completos e segredos não aparecem na tabela/API nova.
- O visual usa fundo grafite-azulado neutro, superfície clara sobre fundo
  escuro, verde discreto para autorizado/ação principal e vermelho apenas
  para bloqueio. As cores nunca são o único indicador: todos os estados
  têm texto explícito.

O atalho **Abrir Campanhas.cmd** abre a Visão geral. O novo fluxo simples
fica em `/enviar`. A rota antiga `/campanhas` continua válida para
filas e importações, com todos os dados anteriores preservados.

Também existe o atalho `Abrir Campanhas.cmd` na pasta oficial
`C:\projeto01\captacao\caca-promos-vip`.
O painel é local (127.0.0.1) e não pede chave de acesso.
As instâncias existentes 3040 e 3045 têm bases de dados privadas distintas.

## Primeiro passo: abrir e conectar o WhatsApp Web

1. Abra no ACER `http://127.0.0.1:3045/campanhas`.
2. Na seção **Conectar seu WhatsApp Web**, clique em **Abrir WhatsApp Web**.
   O sistema abre uma janela visível do Chrome no endereço oficial
   `https://web.whatsapp.com/`, usando o perfil persistente das promoções.
3. Se aparecer um QR Code, no celular abra **WhatsApp → Aparelhos conectados
   → Conectar aparelho** e escaneie o código da janela do Chrome.
   Se o WhatsApp já estiver conectado, aguarde a lista de conversas aparecer.
4. O painel mostra **Escaneie o QR** ou **Conectado**, conforme o estado.
   Não copia QR Codes, tokens ou cookies para o painel.
5. Quando suas conversas aparecerem, clique em **Salvar sessão e fechar**.
   O login permanece no perfil do Chrome. A janela deve ser fechada
   **antes de preparar convites**, para liberar a mesma sessão do navegador.

Essa etapa não usa a planilha, não acessa contatos de campanhas e
**não envia nenhuma mensagem**. O botão não exige número novo da Meta.
Se a sessão já estiver ocupada pelo robô de promoções ou por outra
instância do painel, finalize a utilização anterior primeiro.
O modo de conexão e o modo de envio compartilham uma trava de sessão local.

## Por que a fila pode ficar desabilitada?

Conectar o WhatsApp Web **não ativa a fila de envio**. O botão
**Criar fila para WhatsApp Web** será habilitado quando houver um CSV
importado **nesta aba** e pelo menos um telefone estiver registrado
como autorizado.

### Planilha com autorização obtida anteriormente

Para listas de pessoas que **já autorizaram expressamente convites
comerciais**, não é necessário solicitar novo cadastro por QR Code nem
exigir que cada pessoa envie `QUERO VIP`.

1. Selecione o CSV `nome;telefone` ou um CSV com colunas `Telefone;Grupo;Coletado em;Autorizado para envio`. Se houver a coluna de autorização, apenas linhas marcadas `SIM` são selecionadas; `NÃO` ou campo vazio ficam fora. O arquivo é lido no navegador, e marcar `SIM` não substitui a documentação do consentimento.
2. Em **Registrar autorização da sua planilha**, informe **onde** a
   autorização foi obtida, **a data verdadeira** e uma **referência
   onde o aceite pode ser comprovado**.
3. Marque a declaração de que cada pessoa da planilha já autorizou o
   recebimento **dessas mensagens promocionais individuais**.
4. Clique em **Registrar autorizações da planilha**. Contatos aceitos
   são gravados somente no servidor local, identificados com
   `autorizacao-externa-declarada-com-origem-e-data`, sem simular
   uma confirmação do próprio destinatário pelo sistema.
5. Os números autorizados são liberados para criar a fila. Bloqueados
   ou descadastrados **não são reativados**, mesmo após reimportação.

A declaração do operador é um **registro da informação fornecida**,
não uma prova independente do consentimento. Guarde as evidências reais.
Não invente uma data comum para autorizações recebidas em dias
diferentes: divida a planilha em lotes por data, se necessário.

Quem ainda não autorizou pode se inscrever pelo fluxo voluntário
`/c/<origem>` e confirmar o pedido pelo próprio WhatsApp.
Só participar de um grupo, aparecer numa planilha ou fornecer o
telefone não constitui autorização para publicidade.

Os contatos aprovados são gravados em `dados/contatos-autorizados.json`
na instalação local; as portas 3040 e 3045 possuem bases privadas
separadas. O CSV permanece no navegador até a confirmação. Nenhum
arquivo de contatos é publicado no GitHub. Reimporte o CSV após
recarregar a página para fazer outra campanha.

## Interface simplificada (WhatsApp Web como padrão)

A página /campanhas apresenta três etapas, nesta ordem:

1. **Seus contatos:** selecione o CSV. Se o telefone já está autorizado no
   cadastro local, será reconhecido. Para novos consentimentos, abra
   **Registrar autorizações de novos contatos** e preencha origem, data e
   referência verdadeiras. Não existe autorização presumida para quem apenas
   consta de um grupo.
2. **Sua mensagem:** escreva o texto e link do grupo e clique em
   **Salvar convite**. Visualização, nome da campanha e recursos da Meta
   ficam recolhidos.
3. **Enviar pelo WhatsApp Web:** abra ou crie a fila e use
   **Preparar próximo contato**. A lista mostra até 12 contatos por vez,
   com busca e **Mostrar mais contatos**. O envio continua exigindo
   confirmação individual.

A integração paga da Meta fica em **Recursos avançados**. O botão
**Gerenciar filas** disponibiliza a atualização e a limpeza das filas.

### Limpeza segura de filas

Para apagar somente a fila aberta, clique em **Limpar esta fila**, no topo
dos detalhes. A lista de contatos fica recolhida em **Ver lista de
contatos**; use **Preparar próximo contato** para continuar sem expandi-la.
Se preferir limpar todas as filas pendentes, abra **Gerenciar filas** e
clique em **Limpar filas antigas**. Em ambos os casos, digite `LIMPAR`
para confirmar que nenhum envio ficou sem registro. Somente filas sem tentativas ou envios registrados
podem ser limpas. O servidor recusa a limpeza quando uma janela do
WhatsApp está ativa, inclusive durante o encerramento do Chrome.

Antes de limpar, o servidor arquiva a fila completa de forma privada em
`dados/backups-privados/`. Contatos, consentimentos, bloqueios e a
mensagem salva permanecem intactos. Quando houver envio registrado ou
resultado incerto, confira o histórico em vez de zerar os registros,
pois apagá-los permitiria novos convites indevidos ou resetaria os
limites operacionais.

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
8. Se a pessoa responder **SAIR** ou **NÃO TENHO INTERESSE**,
   registre **Recebi “Não tenho interesse” / SAIR** na fila.
   Isso registra um pedido de saída, sem inventar denúncia. O contato é
   descadastrado e continua bloqueado após reimportações.
9. Se o WhatsApp estiver ocupado pelo robô de promoções ou o Chrome não
   abrir, finalize primeiro a sessão de conexão. Se a automação
   continuar indisponível, desmarque **Usar a automação de Chrome** e
   utilize a alternativa **Abrir conversa no WhatsApp** para enviar
   manualmente.

A mensagem no WhatsApp Web inclui o link do grupo e a opção de
responder `SAIR`. **Depois de atualizar o Netlify**, também inclui
um link exclusivo **Não tenho interesse** para cada contato. Esse
link permite solicitar o bloqueio de novos convites, não denunciar.

**O WhatsApp Web gratuito não admite botões de resposta rápida nativos.**
A prévia dos botões no painel é ilustrativa. Criar botões reais na
mensagem exige recurso compatível com a plataforma WhatsApp Business.

## Não tenho interesse por clique no Netlify (sem API Meta)

O site público vive em `denuncias-netlify/`, com HTML estático,
três Netlify Functions (incluindo a nova `/api/recusar`) e armazenamento
Netlify Blobs. **Não expomos a porta 3045**: o ACER consulta a fila
do Netlify por HTTPS de saída.

1. Para cada contato, a Central assina `UUID.HMAC` com o segredo
   compartilhado apenas entre o ACER e o Netlify. O link não contém telefone
   nem nome. O motivo `saida-solicitada` tem assinatura diferente de
   `denuncia-convite`, impedindo que os dois sejam confundidos.
2. Abrir `GET /nao-tenho-interesse/` não registra nada. Somente o
   clique em **Não quero receber novos convites** envia um
   `POST /api/recusar` ao Netlify.
3. O ACER consulta `GET /api/denuncias-pendentes` por HTTPS e Bearer.
   A resposta inclui o **motivo**. Só depois de registrar o pedido de saída
   no ACER, bloquear o número e persistir o dado, o sistema confirma o
   evento remoto. A confirmação pode ser repetida sem gerar duplicação.
4. Links antigos `/denunciar/` continuam válidos e são registrados como
   denúncias internas anteriores, não como recusa. O histórico é preservado.
5. Enquanto o ACER está ligado, a sincronização ocorre aproximadamente
   a cada **10 minutos**. O botão de busca manual no painel antecipa a consulta.

A confirmação ao destinatário informa que sua preferência de
**não receber novos convites** foi registrada. Ela não é uma denúncia
ao WhatsApp. Se o ACER estiver desligado, a solicitação permanece no
Netlify até a próxima sincronização. O bloqueio só é confirmado
localmente quando a sincronização for concluída.

### Publicação na sua conta Netlify

- Atualize o site **cacapromosdenuncias** já existente no Netlify
  (não crie outro). A publicação anterior foi manual: faça novo deploy
  pelo painel de **Implantações (Deploys)** com o ZIP atualizado.
- Também é possível configurar o site pelo GitHub, diretório-base:
  `captacao/caca-promos-vip/denuncias-netlify`.
- Em `netlify.toml`, o publish é `public` e as Functions são `netlify/functions`.
- Na configuração de ambiente do site (escopo **Functions**), crie
  `CPV_DENUNCIA_NETLIFY_SECRET` com 64 dígitos hexadecimais aleatórios.
  **Nunca adicione o segredo ao GitHub nem à mensagem do WhatsApp.**
- No computador ACER, salve somente em
  `dados/previa-acer/denuncias-netlify-config.json`:
  `{"publicBaseUrl":"https://seu-site.netlify.app","segredo":"MESMO_SEGREDO"}`.
  Mantenha esse arquivo fora do controle de versão e preserve nos backups.
- Reinicie a Central após configurar a URL e confira se
  **Denúncias internas recebidas** indica conexão Netlify.
  Teste com **contato fictício**, depois com um contato de teste voluntário,
  antes de divulgar a página.

Sem HTTPS e segredo configurados, o convite mantém a instrução
`responda SAIR`, sem link falso. O novo link **fica desativado por padrão**
mesmo que alguém reinicie o ACER antes da publicação. Depois que
`GET /nao-tenho-interesse/` e `POST /api/recusar` estiverem disponíveis,
execute `scripts/ativar-recusa-netlify.ps1` no ACER: o script valida
a página, a função pública, o segredo e cria backup, depois ativa
`recusaAtiva:true` na configuração privada. Só então reinicie a porta 3045. A API local e o painel
não são publicados pelo Netlify. Functions e Blobs têm limites no
plano gratuito.

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
