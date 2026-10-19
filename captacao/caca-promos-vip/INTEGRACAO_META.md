# Integração oficial WhatsApp Business Platform — preparação v0.1

Esta etapa prepara o Caça Promos VIP para conectar a **Cloud API da Meta**.
A conta Meta ainda precisa ser criada e o envio pela API está **desativado**.
O fluxo de campanha manual `wa.me` existente não foi alterado.

## Antes de começar

- Conta pessoal da Meta/Facebook com verificação em duas etapas.
- Portfólio empresarial Meta Business. Informe o nome verdadeiro da operação, país,
  e contatos do negócio. Documentos de verificação da empresa podem ser solicitados.
- Um número para o WhatsApp Business. **Prefira um número novo e exclusivo**,
  para não arriscar o histórico do WhatsApp principal. Se quiser reutilizar
  o número do aplicativo Business, confirme antes as opções de coexistência
  por Embedded Signup; o fluxo padrão da Cloud API pode não preservar
  o funcionamento do aplicativo.
- Contatos com **opt-in claro para convites comerciais do Caça Promos VIP**.
  Extrair telefones de um grupo não equivale a esse consentimento.

## Como criar na Meta (ações realizadas pelo proprietário da conta)

1. Acesse `https://business.facebook.com/` e crie ou selecione seu
   **Portfólio empresarial**. Use dados reais e habilite 2FA.
2. Acesse `https://developers.facebook.com/apps/`, clique em **Criar aplicativo**.
   Selecione o fluxo/caso de uso ligado ao **WhatsApp** (a tela pode variar).
   Associe o aplicativo ao portfólio empresarial.
3. Na configuração do WhatsApp, abra **API Setup / Configuração da API**.
   Anote *com segurança* o **App ID**, **WABA ID**, **Phone Number ID**,
   o número de teste e os dados de sandbox. Não envie tokens ou segredos
   em chats, prints, GitHub ou relatórios.
4. Teste o número de testes e o modelo permitido na própria interface Meta,
   com um telefone que **você controla**. Ainda não importamos nenhuma campanha real.
5. Selecione o número de produção, valide a titularidade via SMS ou ligação,
   configure o PIN de verificação em duas etapas e conclua o perfil empresarial.
6. Configure a cobrança da categoria **Marketing** e cheque preços atuais para
   o destino Brasil. A Meta cobra mensagens de modelo entregues, conforme categoria
   e mercado; não há valor fixo incluído neste projeto.
7. Gere um **System User Access Token** com as permissões
   `whatsapp_business_messaging` e `whatsapp_business_management`.
   Guarde-o somente no ambiente seguro do servidor.
8. No **WhatsApp Manager / Modelos de mensagem**, crie e envie para aprovação
   o template:
   - Nome: `convite_ofertas_v1`
   - Categoria: `MARKETING`
   - Idioma: `pt_BR`
   - Corpo:
     `Olá {{1}}! Você autorizou receber convites do Caça Promos VIP. Gostaria de conhecer as promoções do {{2}}? A entrada é gratuita e opcional. Se não quiser novos convites, use Denunciar convite ou responda SAIR.`
   - Botão resposta rápida 1: **Entrar no grupo** (payload do sistema `CPV_ENTRAR`).
   - Botão resposta rápida 2: **Denunciar convite** (payload do sistema `CPV_DENUNCIAR`).
   O primeiro botão solicita o link; será necessário implementar a resposta
   com o convite no webhook antes do envio real.
9. Para denúncias e respostas, contrate ou prepare um **endpoint HTTPS público**
   destinado exclusivamente ao webhook, sem expor a Central local do ACER.
   Na Meta configure **Callback URL** em `/webhooks/whatsapp`, um
   **Verify Token** longo e único e a assinatura `X-Hub-Signature-256`
   (verificada pelo nosso servidor).
10. No painel da Meta, assine o campo de webhook **messages** para a conta
    WhatsApp Business. Confirme o desafio de verificação. Lembre que o
    endpoint local `http://127.0.0.1:3045` **não é acessível pela Meta**.
11. Valide no ambiente de teste: convite a um número próprio, clique em
    **Denunciar convite**, evento assinado recebido, bloqueio e nova
    importação do mesmo número (não deve entrar na fila).
12. Apenas depois da aprovação do modelo, opt-in documentado, teste e
    limite de orçamento: planejar a ativação do envio pela API.

## Configuração técnica do projeto (não publicada com segredos)

Variáveis de ambiente esperadas pelo backend:

```text
WA_META_GRAPH_VERSION=v<versao atual da Meta, sem colchetes>
WA_META_PHONE_NUMBER_ID=<ID do telefone comercial na Meta>
WA_META_WABA_ID=<ID da conta WhatsApp Business>
WA_META_ACCESS_TOKEN=<token do System User; mantenha secreto>
WA_META_APP_SECRET=<segredo do aplicativo Meta; mantenha secreto>
WA_META_WEBHOOK_VERIFY_TOKEN=<segredo aleatorio com mais de 24 caracteres>
WA_META_TEMPLATE_NAME=convite_ofertas_v1
```

Use um cofre de segredos ou configuração privada do serviço. **Nunca coloque
esses valores no repositório ou no HTML do painel**.
A presença de variáveis não comprova a conexão; ela precisa ser validada
de forma autenticada contra a Meta em uma etapa futura.

### O que já está implementado

- `src/meta-cloud.mjs`: montagem do corpo da mensagem (sem enviar), extração
  de respostas do webhook, verificação de desafio e HMAC SHA-256 de assinatura.
- `src/denuncias.mjs`: registro idempotente de denúncias e saídas,
  descadastro do contato e bloqueio persistente por fingerprint de número.
  Os números em claro não são duplicados no arquivo de denúncias.
- `src/server.mjs`: `GET/POST /webhooks/whatsapp`; sem segredos, retorna 503.
  POST exige assinatura válida antes de processar qualquer evento.
- `src/campanhas.mjs`: exclui contatos bloqueados nas listas, criação de
  campanhas e preparação de mensagens, mesmo que apareçam novamente no CSV.
- `/campanhas`: mostra se há configuração preenchida, total de denúncias
  e bloqueios, sem expor nenhuma chave. O painel permanece apenas local,
  sem tela de login, por solicitação do proprietário.
- O número de teste, token Meta, aplicativo e WABA reais ainda **não existem
  no ambiente do projeto**. Nada é enviado automaticamente.

### O que ainda falta implementar (bloqueadores de produção)

- Infraestrutura HTTPS pública com dados sincronizados para atualizar
  a Central local sem expor seu painel ou a base de contatos.
- Submissão/aprovação do template de marketing e conferência da versão Graph API.
- Responder ao clique `CPV_ENTRAR` enviando o link do grupo ao solicitante,
  com registro de resultado. O handler atual não faz esse envio.
- Envio individual do modelo pela API, mediante autorização específica,
  confirmação e limites de orçamento/volume; idempotência por destinatário.
- Status de entrega (sent, delivered, read, failed), prevenção de repetição,
  gerenciamento do token, rotação de segredos, retenção e relatórios.

### Privacidade e segurança

O sistema não transforma a extração de números em permissão para publicidade.
Opt-ins devem indicar o nome da empresa e o tipo de mensagens.
O bloqueio de denúncia tem prioridade sobre listas e campanhas existentes.
Uma denúncia interna **não** aciona a ferramenta oficial de denúncia do WhatsApp.

Não exponha `127.0.0.1:3045` diretamente na Internet. O receptor público
deve publicar somente a rota do webhook e validar a assinatura da Meta.

## Testes

```powershell
cd C:\projeto01\captacao\caca-promos-vip
node --test tests\meta-cloud.test.mjs
node --test
```

Os testes usam apenas números fictícios, tokens fictícios e eventos simulados.
Nenhum disparo real é efetuado.

## Fontes oficiais

- https://www.postman.com/meta/whatsapp-business-platform/collection/wlk6lh4/whatsapp-cloud-api
- https://business.whatsapp.com/policy/preview?lang=pt_BR
- https://business.whatsapp.com/products/platform-pricing
- https://www.postman.com/meta/whatsapp-business-platform/folder/tduohwq/webhook-payload-reference
- https://www.postman.com/meta/whatsapp-business-platform/request/lwtlz1k/send-message-template-interactive
