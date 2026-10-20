# Caça Promos VIP 👑 — Convites pelo WhatsApp Web

Painel local para preparar convites ao grupo de promoções **sem API paga**,
com uso supervisionado do WhatsApp Web. O projeto antigo de captação já foi
aposentado; o cadastro/opt-in e os bloqueios seguem preservados como
dependências necessárias do Painel de Campanhas.

## Como abrir

No ACER: **http://127.0.0.1:3045/campanhas**.

Atalho da pasta oficial: `Abrir Campanhas.cmd`.
Código na pasta única `C:\projeto01\captacao\caca-promos-vip`.
Não criar diretórios paralelos no disco C:.

## Fluxo gratuito recomendado

1. Escreva **uma mensagem única para todos** no editor de convite. Configure
   o link `https://chat.whatsapp.com/...` do seu grupo.
2. Importe a planilha `nome;telefone` exportada pela extensão do Chrome.
   A planilha fica no navegador, não é publicada no GitHub nem enviada a
   serviços externos. Números duplicados são eliminados.
3. O painel cruza os telefones importados **apenas com os contatos que já
   confirmaram opt-in para mensagens comerciais**. Telefones capturados de
   grupos de terceiros sem essa autorização **não entram na fila**.
4. Clique em **Criar fila para WhatsApp Web**. A campanha e o texto ficam
   salvos localmente, sem disparos.
5. Escolha **Preparar conversa**. O painel adiciona ao texto original o
   link do grupo e instrução para responder **SAIR** ou **DENUNCIAR**.
6. Clique em **Abrir conversa no WhatsApp**. O recurso oficial `wa.me`
   abre o WhatsApp Web com a conversa/texto preenchidos. Você deve
   conferir a conta e pressionar **Enviar manualmente**. Não há automação
   do WhatsApp, rolagem, sessão extra ou script de envio.
7. Volte ao painel e marque **Confirmo que enviei manualmente** para
   registrar o envio. A campanha impede nova confirmação para o mesmo
   contato e outra conversa simultaneamente preparada.
8. Se o contato responder **SAIR** ou **DENUNCIAR**, clique em
   **Recebi denúncia / SAIR** e confirme o bloqueio. Não existe leitura
   automática dessas respostas no modo gratuito. Contatos bloqueados não
   entram em novas filas, mesmo que reapareçam em outra planilha.
9. Use **Ignorar** se não quiser contatar um número, ou **Cancelar
   preparação** somente quando não houve envio.

### Limites internos

- **1 conversa por vez**, aberta somente depois de clicar.
- **Até 50 conversas preparadas por dia** no horário de Brasília.
- **Sem envio automático**, sem varrer a planilha, sem clicar na conversa,
  sem resposta automática. Não há disparos em segundo plano.
- Histórico por campanha persistente, com deduplicação de convites
  confirmados e exclusão de contatos que tenham revogado consentimento.

**ATENÇÃO:** nenhum temporizador ou limite de velocidade torna seguros os
envios indesejados nem garante evitar banimento. O WhatsApp proíbe mensagens
automáticas ou em massa não autorizadas. O modo gratuito usa apenas o
fluxo nativo de conversa manual: https://faq.whatsapp.com/5913398998672934.

### Como ficam os dois botões desejados

Sem a WhatsApp Business Platform não há botões nativos personalizados de
resposta rápida. O painel utiliza duas ações **no conteúdo da mensagem**:

- **Entrar no grupo:** link clicável `https://chat.whatsapp.com/...`.
- **Denunciar convite:** instrução explícita para responder `DENUNCIAR`
  ou `SAIR`. O operador registra a reclamação no painel depois de
  recebê-la. Isso gera **denúncia interna**, não denúncia oficial à Meta.

O painel mostra uma prévia de botões apenas para a eventual integração
com a API paga. Essa prévia **não corresponde a botões no WhatsApp Web**.

## Recursos preservados

- Cadastro de contatos e evidências de consentimento, separados da planilha.
- Descadastro `/sair`, base de supressão e denúncia interna.
- Fluxo de inscrição voluntária `/c/<origem>`.
- Rascunhos, filas e histórico do projeto; pasta privada `dados/`
  nunca deve ser apagada nem publicada.
- Extensão supervisionada do WhatsApp Web para leitura e exportação de CSV.
- Preparação para a Cloud API da Meta em [INTEGRACAO_META.md](INTEGRACAO_META.md),
  atualmente desativada por falta de número/credenciais.

## Testes e execução

```powershell
cd C:\projeto01\captacao\caca-promos-vip
node --test
```

A página funciona em `127.0.0.1`, no próprio computador e sem chave
administrativa. Requisições locais de escrita exigem origem correspondente.
Dados e credenciais não são enviados ao navegador de terceiros.
Os testes automatizados usam apenas números de exemplo e nunca enviam
mensagens de WhatsApp reais.
