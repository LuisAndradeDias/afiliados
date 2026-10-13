# 👑 Caça Promos VIP — Central de Captação v0.2

Aplicativo independente do robô principal Afiliados. Permite **divulgar um convite aprovado pelo administrador de uma comunidade**, receber **pré-cadastros voluntários**, registrar **autorização comprovada em duas etapas**, preparar convites individuais manualmente com **um segundo WhatsApp Business** e exportar planilhas.

**Não faz:** extração de telefones de grupos alheios, importação de listas raspadas, conexão ao WhatsApp Web para ler grupos ou disparos automáticos de mensagens. Configurar o número secundário **não** ativa nenhuma integração de envio.

## Como funciona

1. No painel, informe uma **origem** de campanha como `parceria-01` e copie o convite; compartilhe em grupos de terceiros **somente quando o administrador autorizar**.
2. A pessoa pode entrar diretamente no grupo VIP pelo botão **sem fornecer telefone**. Opcionalmente, preenche o formulário com seu número e assinala consentimento para mensagens **individuais** sobre promoções.
3. O número fica como **pendente**, com data, texto da autorização e código aleatório.
4. Após configurar o segundo número, a pessoa deve **iniciar uma conversa** com o WhatsApp Business secundário e enviar `QUERO VIP XXXXXX`.
5. Você confere a mensagem recebida e digita o código na **Central de Captação**. Somente depois disso o contato fica **autorizado**.
6. Em um contato autorizado, clique **Preparar convite**. O programa abre uma **prévia** e um link `wa.me` para você revisar e enviar manualmente pela **conta secundária**. O programa não escolhe sua conta do WhatsApp; confirme que está na conta correta.
7. Quando houver pedido de descadastro (`SAIR`), clique **Descadastrar**. Também é possível excluir definitivamente os dados de um contato descadastrado.

## Abrir no Windows

Após a instalação em `C:\projeto01\captacao\caca-promos-vip`:

- **Área de trabalho → Caca Promos VIP - Central de Contatos** ou dê dois cliques em `Abrir Central de Contatos.cmd`.
- **Página de captação:** `http://127.0.0.1:3040/c/instagram`
- **Painel de contatos:** `http://127.0.0.1:3040/painel`
- **Relatório antigo agregado:** o atalho antigo **Caca Promos VIP - Relatorio** continua funcionando.
- **Chave de acesso:** `C:\projeto01\captacao\caca-promos-vip\dados\chave-admin.txt`. Não compartilhe nem publique.

Se estiver testando sem instalação anterior, extraia o ZIP completo numa pasta e abra `iniciar-piloto.bat`.

## Atualizar instalação existente no computador Luis

1. Feche o programa antigo de captação na porta 3040, se estiver aberto.
2. Extraia o ZIP numa pasta temporária, por exemplo `Downloads\Captacao-v02`.
3. Clique com o botão direito em **`atualizar-no-luis.ps1`** e escolha **Executar com PowerShell**, ou abra o PowerShell e execute o script da pasta extraída.
4. A atualização copia os arquivos novos para `C:\projeto01\captacao\caca-promos-vip` e cria o atalho da Central de Contatos.
5. O instalador faz backup **do código anterior** em `C:\projeto01\captacao\caca-promos-vip\backups\` e **não modifica** a pasta `dados\`, a chave administrativa, as métricas, o histórico ou `C:\projeto01`.
6. Abra o novo atalho e valide a página e o painel.

Alternativa pelo terminal, dentro da pasta extraída:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\atualizar-no-luis.ps1
```

## Exportar planilhas

Na Central de Contatos, use **Exportar CSV** para baixar a lista atual, com status, telefone, origem, data do pedido, data da confirmação e data de descadastro. O CSV é protegido pela sessão administrativa. O Excel abre o CSV com separador `;`.

O botão **Modelo Excel** baixa `Modelo_Contatos_Autorizados.xlsx`, também incluído no ZIP. O modelo inclui campos, validação de status e uma aba com orientações. Ele não importa telefones automaticamente para o sistema.

Nunca envie mensagens para entradas `pendente` ou `descadastrado`. Não compartilhe as planilhas; armazenam dados pessoais.

## Segurança e privacidade

- O servidor usa `127.0.0.1` por padrão. **Links localhost não funcionam para pessoas fora do computador**. Não poste os links locais em grupos ou redes sociais.
- Para disponibilizar a landing page ao público, será necessário configurar hospedagem **HTTPS** com painel administrativo e arquivos de contatos protegidos. O projeto local não deve ser exposto diretamente na internet sem revisão de segurança, autenticação e proteção de dados.
- Os contatos são salvos em `dados/contatos-autorizados.json` (fora do ZIP). A chave de administrador e as métricas permanecem em `dados/`.
- O login usa cookie temporário, `HttpOnly` e `SameSite=Strict`; ações administrativas exigem cabeçalho adicional. Não guarde a chave em aplicativos de compartilhamento.
- O registro de confirmação depende de conferência humana: o programa não tem acesso às mensagens recebidas no WhatsApp.
- O usuário pode responder **SAIR**; o administrador deve registrar o descadastro imediatamente. Um link de cancelamento pessoal pode ser incluído nos convites quando `CAPTACAO_PUBLIC_BASE_URL` apontar para um endereço HTTPS devidamente configurado.
- Se quiser apagar dados pessoais, descadastre e use **Excluir dados**. Planeje prazo de retenção e cópias de segurança compatíveis com sua política de privacidade.
- Sem nenhuma integração com WhatsApp Cloud API; a futura automação só deve ser habilitada após autorização válida, número dedicado e regras da plataforma.

## Testes

Requer Node.js 18 ou superior; não há dependências externas:

```powershell
npm test
npm start
```

**Arquitetura:** `src/server.mjs` (rotas), `src/analytics.mjs` (métricas anônimas), `src/contatos.mjs` (cadastros e autorizações), `src/templates.mjs` (landing e relatório), `src/crm-ui.mjs` (painel), `src/assets/` (interfaces), `modelos/` (planilha).

## Configuração opcional

| Variável | Padrão | Descrição |
|---|---|---|
| `HOST` | `127.0.0.1` | Interface de rede local |
| `PORT` | `3040` | Porta do projeto secundário |
| `DATA_DIR` | `./dados` | Diretório de dados e chave administrativa |
| `CAPTACAO_GROUP_URL` | Convite Caça Promos VIP | URL HTTPS de convite do grupo |
| `CAPTACAO_PUBLIC_BASE_URL` | não definido | HTTPS público para anexar link pessoal de cancelamento na mensagem |
| `CAPTACAO_PUBLIC_HTTPS` | `false` | Marcar `true` apenas atrás de HTTPS público para o cookie `Secure` |

**Fase atual:** versão 0.2 testada localmente, com painel de contatos e fluxo de consentimento. Instalação no computador Luis e publicação HTTPS dependem de disponibilidade e configuração do ambiente. Nenhum disparo real ocorreu.
