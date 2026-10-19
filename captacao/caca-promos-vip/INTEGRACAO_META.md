# Caça Promos VIP — convite único e WhatsApp Business Cloud API

## Objetivo e estado

O painel está preparado **antes de comprar ou cadastrar um número**.
Acesse no ACER: `http://127.0.0.1:3045/campanhas` — **sem chave administrativa**,
somente no próprio computador.

A mensagem é **idêntica para todas as pessoas**. Não há variáveis `{nome}`,
`{grupo}` nem parâmetros de corpo no envio pela Meta.

O convite prevê exatamente dois botões nativos do WhatsApp:
- **Entrar no grupo** — resposta rápida `CPV_ENTRAR`. Após o clique do
  destinatário, o webhook responde com o link do grupo, desde que a conta
  esteja configurada e o envio tenha sido habilitado.
- **Denunciar convite** — resposta rápida `CPV_DENUNCIAR`. O webhook,
  após verificar assinatura HMAC, registra denúncia interna, descadastra
  o número e impede que ele entre novamente em filas.

**Nenhum envio real é possível sem a ativação explícita da Meta.**
Os dados de teste não são contatos reais nem foram enviados ao WhatsApp.

## O que você já pode fazer sem número

1. No painel, escreva a mensagem única em **Mensagem enviada a TODOS**.
2. Cole o convite de grupo, por exemplo
   `https://chat.whatsapp.com/<seu-convite>`. Um endereço já existente no
   projeto poderá aparecer; confira sua validade.
3. Escolha um nome de campanha e o nome técnico do modelo (padrão
   `convite_ofertas_v1`).
4. Use **Salvar mensagem e link**. O rascunho fica em arquivo local privado
   e permanece depois de fechar e abrir o painel.
5. Veja a **prévia de WhatsApp com dois botões**, apenas ilustrativa.
6. Use **Exportar modelo Meta** para baixar o JSON, pronto para submissão
   posterior à aprovação. O JSON não contém dados pessoais nem credenciais.
7. Importe o CSV `nome;telefone` produzido pela extensão. A planilha fica
   em memória do navegador; apenas contatos com confirmação documentada de
   opt-in no CRM aparecem como elegíveis.
8. Clique em **Simular envio**. Mostra quantidade autorizada e bloqueada,
   sem qualquer requisição à Meta.
9. Se houver destinatários autorizados, clique em **Preparar fila de convites**.
   A fila persiste mesmo sem número. Mensagem, modelo e link são congelados
   para aquela campanha; futuras edições não alteram retroativamente a fila.
10. Consulte filas, estados, denúncias, bloqueios e baixe o relatório CSV
    de andamento com telefones mascarados.

O painel mantém o fluxo manual antigo em **Modo manual anterior (opcional)**.

## Mensagem de exemplo (idêntica para todos)

```text
🎁 Convite Caça Promos VIP 👑

Olá! Você autorizou receber novidades e convites do Caça Promos VIP.
Temos um grupo gratuito com promoções, descontos e oportunidades selecionadas.
Deseja conhecer nosso grupo de ofertas?

A entrada é opcional. Para não receber novos convites, toque em Denunciar convite ou responda SAIR.
```

A palavra “autorizou” só deve ser utilizada com pessoas que realmente
tenham consentido em receber convites de marketing no WhatsApp.
**Ser participante de um grupo ou constar de uma planilha não configura opt-in**.

## Quando adquirir o número — checklist da Meta

1. Entre em `https://business.facebook.com/settings` e crie o portfólio
   empresarial com os dados reais da operação e autenticação em duas etapas.
2. Em `https://developers.facebook.com/apps/`, crie um aplicativo com o caso
   de uso WhatsApp e associe o portfólio.
3. Inicie a configuração da Cloud API com número de teste. Depois registre
   e verifique seu número de produção, habilite cobrança e conclua o perfil.
4. Localize **WABA ID**, **Phone Number ID**, **App Secret** e a versão Graph API.
   Crie um token de acesso de usuário de sistema com permissões adequadas.
   **Não compartilhe tokens ou App Secret no chat ou GitHub**.
5. Exporte o JSON do modelo no painel, e crie na Meta um template de
   categoria **MARKETING**, idioma `pt_BR`, corpo idêntico e dois
   botões de resposta rápida na ordem indicada. Aguarde **APPROVED**.
6. Prepare um receptor público **HTTPS** que entregue exclusivamente
   `GET/POST /webhooks/whatsapp` ao backend. Não publique nem exponha
   o painel `/campanhas`, o CRM `/painel` ou a porta local 3045.
   Um reverse proxy/túnel de acesso restrito à rota de webhook será
   necessário e **ainda não está configurado**.
7. Cadastre na Meta o callback HTTPS, um Verify Token aleatório e assine
   o campo `messages`. Nosso backend valida a assinatura
   `X-Hub-Signature-256` antes de alterar contatos.
8. Configure as variáveis privadas do backend e reinicie o serviço.
   A ativação de envio **não** é automática; escolha o limite diário.
9. Valide, com números seus e modelo aprovado, o clique no botão
   **Entrar no grupo** (resposta com link), **Denunciar convite**
   (bloqueio) e o acompanhamento de estados da Meta.
10. Só então importe destinatários com opt-in documentado e use
    **Enviar próximo lote (até 10)**, com confirmação explícita.

## Variáveis privadas do serviço (sem commit)

```text
WA_META_GRAPH_VERSION=v<VERSAO_SUPORTADA>
WA_META_PHONE_NUMBER_ID=<PHONE_NUMBER_ID>
WA_META_WABA_ID=<WABA_ID>
WA_META_ACCESS_TOKEN=<SYSTEM_USER_ACCESS_TOKEN>
WA_META_APP_SECRET=<APP_SECRET>
WA_META_WEBHOOK_VERIFY_TOKEN=<TOKEN_LONGO_ALEATORIO>
WA_META_TEMPLATE_NAME=convite_ofertas_v1
WA_META_MAX_DAILY=50
WA_META_ENABLE_SENDING=false
```

Coloque as credenciais em um cofre/ambiente privado do serviço. Troque para
`WA_META_ENABLE_SENDING=true` **apenas depois** de validar opt-in, modelo,
número de produção, webhook e orçamento. O painel sem login NÃO oferece
campos para colar segredos — só roda em `127.0.0.1` e não guarda tokens.

O backend verifica o modelo na Meta antes **de cada lote**, comparando
nome, idioma, estado APPROVED, corpo e os dois botões. Se algo divergir,
rejeita o envio. O máximo por clique é 10 na interface e 20 no servidor.
Há limite diário (padrão 50, configurável até 500) para limitar custos.

Por segurança, uma tentativa iniciada é persistida antes da API. Se houver
falha de conexão, o contato fica marcado como **incerto**, sem reenvio
automático; reconcilie manualmente antes de tentar outra ação.

## Implementação

- `src/convites-unicos.mjs`: rascunho persistente e único; simulação, filas
  por IDs autorizados, snapshots imutáveis, verificação de modelo e processamento
  supervisionado de lotes.
- `src/meta-cloud.mjs`: payload do template estático, botões, verificação
  de status APPROVED, chamada protegida `POST /messages`, processamento
  de webhook e resposta ao botão Entrar no grupo.
- `src/denuncias.mjs`: denúncias idempotentes, hash de supressão
  persistente e descadastro.
- `src/server.mjs`: rotas locais de campanhas protegidas contra origem
  indevida, webhook assinado e endpoints para rascunho, simulação, filas,
  status, envio e denúncias.
- `src/assets/campanhas.js` + `src/campanhas-ui.mjs`: editor, prévia,
  importação de CSV, filtros de opt-in, simulação, filas e relatórios.
- Arquivos locais privados em `dados/` (fora do GitHub):
  `modelo-convite-unico.json`, `filas-convites-meta.json`,
  `respostas-convites-meta.json` e a base de denúncias.

**Limitações que dependem da Meta:**
- A Cloud API, o modelo aprovado, cobrança e o número real ainda não existem
  no projeto.
- O endpoint HTTPS público e o roteamento seguro até o backend serão
  necessários para receber cliques e status reais.
- O status "aceito" significa aceito pela API, não entregue.
- Uma denúncia interna não aciona a denúncia oficial ao WhatsApp.
- Não existe disparo para telefones extraídos sem consentimento.

## Testes

```powershell
cd C:\projeto01\captacao\caca-promos-vip
node --test
```

Os testes usam arquivos temporários, números e credenciais fictícios,
transporte HTTP simulado e Chrome com dados sintéticos. Nunca enviam
mensagens para pessoas reais.

## Referências oficiais

- https://www.postman.com/meta/whatsapp-business-platform/request/lwtlz1k/send-message-template-interactive
- https://www.postman.com/meta/whatsapp-business-platform/request/uzphwqw/create-template-w-text-header-text-body-text-footer-and-2-quick-reply-buttons
- https://www.postman.com/meta/whatsapp-business-platform/folder/tduohwq/webhook-payload-reference
- https://business.whatsapp.com/policy
- https://business.whatsapp.com/products/platform-pricing
