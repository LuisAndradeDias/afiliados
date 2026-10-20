# Caça Promos VIP 👑 — Painel de Campanhas

Sistema em desenvolvimento para preparar convites ao grupo de promoções por meio da
**WhatsApp Business Platform (Cloud API)**. O painel antigo de captação foi
aposentado; existe **um único painel operacional**, local e sem chave administrativa.

## Onde abrir

- No ACER: `http://127.0.0.1:3045/campanhas`
- Atalho na pasta: **`Abrir Campanhas.cmd`**
- Outros computadores, depois de instalados: o iniciador detecta a instância
  local (preferência 3045 ou 3040) ou inicia o serviço na pasta oficial.
- URLs antigas `/` e `/painel` redirecionam para `/campanhas` quando abertas
  no próprio computador. Não há mais a tela `Central de Captação v0.5`.

O código e os dados permanecem exclusivamente na instalação oficial:
`C:\projeto01\captacao\caca-promos-vip`.
Não crie projetos, worktrees ou pastas duplicadas em `C:\`.

## O que o novo painel faz

1. **Convite único**: escreva uma mensagem idêntica para todos, sem variáveis
   por destinatário; configure o link do grupo de ofertas.
2. **Botões no WhatsApp**: `Entrar no grupo` e `Denunciar convite`,
   como duas respostas rápidas de um template de marketing a ser aprovado.
3. **Planilha CSV**: importe o arquivo `nome;telefone` exportado pela
   [extensão para Chrome](extensao-lateral/README.md). A planilha fica
   na memória do navegador; o serviço cruza os números com os opt-ins
   confirmados no cadastro.
4. **Simulação**: prepare a mensagem, confira contatos aptos e bloqueados
   e crie filas persistentes sem número Meta.
5. **Envio pela API**: somente depois de configurar número, aprovação
   do template, webhook, orçamento e autorização; cada lote depende de
   confirmação explícita. Sem conta configurada, o envio fica bloqueado.
6. **Denúncias e descadastros**: quando o webhook receber denúncia assinada,
   o contato é bloqueado para campanhas futuras, inclusive após uma
   nova importação. Relatórios usam telefones mascarados.

**Não faz envio para números retirados de grupos sem consentimento
específico para mensagens comerciais.** Ter um número no CSV não equivale
a autorização para publicidade.

## O que foi retirado

- HTML da antiga Central de Captação e seus scripts de painel/importação.
- Modo de convite manual via `wa.me` que ainda aparecia no painel novo.
- Atalhos de relatório e chave do projeto antigo, iniciador obsoleto e
  instaladores antigos para o computador Luis.
- Documentação obsoleta das versões de captação anteriores.

O histórico de código desses itens continua recuperável pelo Git.

## O que foi preservado de propósito

- `dados/` inteiro: cadastro, autorizações, chaves internas, opt-outs,
  bloqueios, denúncias, campanhas, métricas e rascunhos. **Não apagar.**
- APIs existentes de contato/consentimento, grupos e importação, usadas
  para auditoria e compatibilidade. As rotas administrativas continuam
  protegidas, embora não exista mais a antiga tela de login.
- `/c/<origem>`: página opcional de **cadastro voluntário**, útil para
  coletar consentimento de quem realmente desejar mensagens.
  Para abri-la há o atalho **`Abrir Cadastro Voluntario.cmd`**.
- `/sair` e `/api/descadastro`: descadastro voluntário independente.
- Extensão de leitura supervisionada dos participantes do WhatsApp Web.
- Base de campanhas históricas e de proteção contra reenvio.

Os dados pessoais e os segredos de acesso nunca devem entrar no GitHub.

## Quando adquirir o número WhatsApp Business

Siga [INTEGRACAO_META.md](INTEGRACAO_META.md): crie o portfólio e aplicativo
Meta, conecte o número, configure cobrança e token privado, aprove
o modelo MARKETING e prepare um **webhook HTTPS público exclusivo**.
O painel de campanhas local **não deve ser exposto à Internet**.

Até essa etapa, `WA_META_ENABLE_SENDING=false` e nenhum envio real é realizado.

## Desenvolvimento e testes

```powershell
cd C:\projeto01\captacao\caca-promos-vip
node --test
node src\server.mjs
```

O serviço escuta em `127.0.0.1` por padrão. O iniciador `Abrir Campanhas.cmd`
seleciona a instalação/diretório de dados existente e abre a interface
no navegador, sem exigir senha. Não reinicia o robô principal de afiliados.

**Segurança**: o painel de campanhas sem senha é intencionalmente **somente
local**. Solicitações de escrita exigem origem local correspondente e cabeçalho
de proteção; a Cloud API exige credenciais privadas, e os eventos Meta são
validados com HMAC. O registro de um contato permanece distinto de seu opt-in.
