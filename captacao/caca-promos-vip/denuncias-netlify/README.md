# Caça Promos VIP — Preferências pelo Netlify

Este site público permite que a pessoa escolha **Não tenho interesse**
e pare de receber convites. O ACER continua privado, sem publicar
a porta 3045 ou a lista de contatos.

## Funcionamento

- **Novo link:** `/nao-tenho-interesse/?token=...` exibe a página; somente
  o clique em **Não quero receber novos convites** executa
  `POST /api/recusar` e registra um evento do tipo `saida-solicitada`.
- **Sincronização:** `GET /api/denuncias-pendentes` (Bearer privado) entrega
  eventos ao ACER. Só após registrar a saída e bloquear o número localmente
  o ACER confirma a remoção do evento remoto.
- **Legado:** `/denunciar/` e `POST /api/denunciar` continuam funcionando
  para links antigos, sem serem confundidos com a opção de saída.
- O token inclui apenas UUID pseudônimo e HMAC assinado; não inclui o
  número nem o nome. A prévia de link por GET não registra pedidos.
- A confirmação não envia denúncia oficial ao WhatsApp e não remove
  ninguém de um grupo do qual já participe.

## Publicação no site existente

1. No Netlify, abra o projeto **cacapromosdenuncias**.
2. Em **Implanta (Deploys)**, envie o novo ZIP preparado no ACER, **para
   o mesmo site**, sem criar outro. O ZIP inclui o HTML estático,
   `netlify.toml`, `package.json`, `package-lock.json`, `lib/` e
   as três funções em `netlify/functions/`.
3. **Não mude** a variável de ambiente já cadastrada:
   `CPV_DENUNCIA_NETLIFY_SECRET` (escopo Functions, produção).
4. Confirme que o site `https://cacapromosdenuncias.netlify.app/`
   abre, que `/nao-tenho-interesse/` exibe o texto atualizado, e que
   `POST /api/recusar` rejeita um token fictício (HTTP 404), não 503.
5. No ACER, execute
   `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ativar-recusa-netlify.ps1`
   na raiz do projeto `captacao/caca-promos-vip`. Esse script verifica
   a implantação, cria um backup da configuração privada e habilita
   `recusaAtiva:true`; não mostra nenhuma chave na saída.
6. Depois reinicie o painel 3045. Se o site ainda não estiver pronto,
   o script recusa a ativação e o convite continuará oferecendo SAIR
   por texto, sem link novo quebrado.

**O WhatsApp Web gratuito não fornece botões nativos com essa função**.
A mensagem usa um link clicável de recusa e aceita resposta por texto SAIR.
A opção de botões reais requer um caminho técnico separado.

**Privacidade:** nunca coloque o arquivo secreto do ACER, planilhas,
contatos ou diretório `dados/` no ZIP. Os serviços do Netlify
estão sujeitos aos limites do plano contratado.
