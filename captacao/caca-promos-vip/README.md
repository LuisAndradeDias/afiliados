# Caça Promos VIP 👑 — Convites pelo seu WhatsApp Web

Painel local de campanhas que reutiliza o **Chrome, Playwright, perfil persistente
e observador de envio** do robô de promoções. Não depende da API paga da Meta,
de um segundo WhatsApp nem de SDKs não oficiais. A automação é **supervisionada,
uma conversa de cada vez**, somente para contatos que consentiram em receber
convites comerciais.

**Acesso no ACER:** http://127.0.0.1:3045/inicio

## Central de gestão — experiência reorganizada

O painel está dividido em **quatro áreas com navegação fixa**:

1. **Visão geral** (`/inicio`): mostra contatos, autorização, bloqueios,
   denúncias recebidas e resumo das filas.
2. **Contatos** (`/contatos`): cadastro separado, pesquisa por nome ou
   telefone, filtros `Autorizados`, `Bloqueados`, `Descadastrados`,
   `Pendentes` e `Sem autorização`. Exibe 15 por página e mascara números.
   A ficha informa origem, evidência do consentimento e eventos vinculados.
3. **Enviar convites** (`/campanhas`): mantém o fluxo supervisionado do
   WhatsApp Web em 3 etapas (selecionar CSV → escrever mensagem → preparar
   conversa), sem mudar a confirmação individual antes do envio.
4. **Denúncias** (`/denuncias`): histórico de reclamações internas, pedidos
   de saída e bloqueios administrativos. Inclui sincronização manual Netlify.

### Segurança e bloqueios

- `Bloqueado` corresponde a uma denúncia interna recebida, um pedido de
  saída persistente ou um **bloqueio administrativo**.
- `Descadastrado` é um contato removido do envio sem um bloqueio por hash
  persistente. As categorias da lista são mutuamente exclusivas.
- **Bloquear novos convites** na ficha exige confirmação e deixa uma marca
  administrativa — **não fabrica denúncia** do destinatário. O bloqueio
  persiste mesmo após importar novamente o número.
- Não há botão de desbloqueio automático. Um consentimento novo deve ser
  verificado em procedimento separado antes de qualquer reativação.
- Os endpoints da Central ficam em `127.0.0.1`; não são publicados pelo
  Netlify. Números completos e segredos não aparecem na tabela/API nova.
- O visual usa fundo grafite-azulado neutro, superfície clara sobre fundo
  escuro, verde discreto para autorizado/ação principal e vermelho apenas
  para bloqueio. As cores nunca são o único indicador: todos os estados
  têm texto explícito.

O atalho **Abrir Campanhas.cmd** abre a Visão geral. O endereço anterior
`/campanhas` continua válido e permite operar o WhatsApp como antes.

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
8. Se a pessoa responder **SAIR** ou **DENUNCIAR**, registre a reclamação
   na fila. O contato é descadastrado e entra na supressão persistente,
   inclusive após reimportações futuras.
9. Se o WhatsApp estiver ocupado pelo robô de promoções ou o Chrome não
   abrir, finalize primeiro a sessão de conexão. Se a automação
   continuar indisponível, desmarque **Usar a automação de Chrome** e
   utilize a alternativa **Abrir conversa no WhatsApp** para enviar
   manualmente.

A mensagem no WhatsApp Web inclui o link do grupo, a opção de responder
`SAIR` / `DENUNCIAR` e, **quando houver um endereço HTTPS público
configurado**, um link exclusivo `Denunciar mensagem` para cada contato.
**O WhatsApp Web gratuito não admite botões interativos nativos.**

## Denúncia interna por clique no Netlify (sem API Meta)

O site público vive em `denuncias-netlify/`, com HTML estático, duas Netlify
Functions e armazenamento Netlify Blobs. **Não expomos a porta 3045**:
a única comunicação é o ACER consultando a fila do Netlify por HTTPS.

1. Para cada contato, a Central assina `UUID.HMAC` com um segredo compartilhado
   **somente entre ACER e Netlify**. O link não inclui nome nem telefone.
2. A pré-visualização da URL (`GET /denunciar/`) não registra denúncia.
   Somente o clique explícito em **Confirmar denúncia** envia um
   `POST /api/denunciar` ao Netlify, que salva um evento pendente.
3. O ACER consulta `GET /api/denuncias-pendentes` por conexão **de saída** e
   autenticação Bearer. O sistema confere a assinatura, registra o bloqueio
   persistente (inclusive após reimportação), descadastra o contato e só então
   confirma a remoção do evento remoto via POST autenticado.
   Se a confirmação remota falhar, repetir é seguro e não duplica eventos.
4. Enquanto o ACER estiver online, a sincronização automática ocorre
   aproximadamente a cada **10 minutos**. O botão
   **Denúncias internas recebidas → Buscar denúncias no Netlify agora**
   antecipa a consulta. O painel atualiza os alertas visíveis a cada 30s.

A confirmação ao destinatário informa claramente que é um registro
**interno ao Caça Promos VIP**, **não** uma denúncia oficial ao WhatsApp
ou à Meta. Se o ACER estiver desligado, a solicitação fica no Netlify
até a próxima sincronização. Nada será falsamente marcado como bloqueado
no ACER antes da sincronização.

### Publicação na sua conta Netlify

- Crie um site pelo GitHub, repositório `LuisAndradeDias/afiliados`.
- Configure o **diretório-base** da compilação como
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

Sem HTTPS e segredo configurados, o convite mantém
`SAIR`/`DENUNCIAR` por texto, sem link falso. A API local e as páginas de
administração jamais são publicadas pelo Netlify. As funções de
Netlify Blobs e Functions estão sujeitas aos limites de uso do plano.

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
