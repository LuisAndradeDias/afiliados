# Integração WhatsApp — viabilidade e caminho de implantação

Atualização do plano: 16/10/2026. Projeto Caça Promos VIP.

## Objetivo de negócio

Organizar, por grupo de origem, telefones de pessoas que autorizaram a coleta e distinguir quem **também** aceitou receber mensagens comerciais. O operador deve escolher o grupo, conferir uma prévia, registrar a evidência e exportar os contatos. Não enviar mensagens durante testes, migrações ou importações.

## Restrições verificadas

- A API oficial do WhatsApp Business Platform / Cloud API atende comunicação empresarial, mas não disponibiliza uma operação geral para listar os membros de grupos comuns do aplicativo pessoal.
- O WhatsApp adverte que a coleta automatizada não permitida de dados pessoais, como números, pode levar a restrições da conta.
- A Política de Negócios exige consentimento específico para receber mensagens no WhatsApp, além do fornecimento do telefone. Permissão de coleta **não é** permissão de publicidade.
- Os Termos do aplicativo WhatsApp Business restringem raspagem de dados e apps de terceiros que interajam sem autorização escrita.

Fontes:
- https://faq.whatsapp.com/434518851968943/?locale=pt_BR
- https://business.whatsapp.com/policy/preview?lang=pt_BR
- https://www.whatsapp.com/legal/WhatsApp-Terms-for-WhatsApp-Business-App
- https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api

## Situação de implementação

**v0.4 (GitHub main):** cadastro manual de grupos, formulário de inscrição voluntária, registro de consentimento, importação de CSV/TXT, normalização e deduplicação, exportação CSV, segregação entre contatos importados e destinatários autorizados.

**v0.5 (branch de desenvolvimento):**
1. Guia inicial de três etapas.
2. Botão no cadastro de cada grupo que abre diretamente a importação daquele grupo.
3. Botão para abrir o convite do grupo no WhatsApp mediante clique do operador.
4. Prévia autenticada, sem escrita em disco, com quantidade de números novos/repetidos/inválidos e indicação de linhas problemáticas.
5. Importação confirmada somente após conferir a prévia e registrar referência de autorização.
6. Script de implantação no computador Luis com backup, atualização fast-forward, testes e reinicialização isolada da porta 3040.

A v0.5 **não acessa chats, não lista contatos do WhatsApp e não faz raspagem dos membros**. A extração direta automática não pode ser anunciada como concluída.

## Próximas etapas condicionais

1. Tornar a página de convite pública via HTTPS, sem expor a área administrativa ou os dados privados.
2. Oferecer cadastro voluntário com link de origem por grupo, confirmação em duas etapas e descadastro.
3. Avaliar uma integração oficial WhatsApp Business Platform para mensagens aos destinatários que fizeram opt-in comercial explícito. Registrar IDs de consentimento, webhooks e auditoria; usar templates aprovados quando aplicável.
4. Somente analisar integrações de grupos se a Meta disponibilizar uma interface oficial compatível com o tipo de grupo e conta e autorizar a finalidade específica.
5. No computador Luis, auditar a sessão e a porta 3040, realizar backup local e executar o instalador v0.5. Não transportar os dados pessoais do ACER via GitHub.

## Verificação e segurança

- Não incluir cookies, tokens, chaves ou sessões WhatsApp no repositório.
- Não transferir planilhas com telefones para o GitHub.
- Armazenar dados apenas sob `dados/`, excluído pelo .gitignore.
- Testar importação com números fictícios e garantir que o robô principal na porta 3030 não é reiniciado.
- Em falhas, preservar a versão anterior e usar o backup local para retorno.
