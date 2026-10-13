# Central de Captação v0.4 — Importação autorizada

A área **Importar** organiza números recebidos com autorização individual de coleta, sem acessar automaticamente a lista de participantes do WhatsApp e sem enviar mensagens.

## Como utilizar
1. No painel, cadastre um **Grupo de origem** e seu link em Grupos.
2. Acesse **Importar** e escolha o grupo.
3. Informe uma referência onde está documentada a autorização individual dos contatos.
4. Cole os telefones (um por linha ou no formato `nome;telefone`) ou escolha um arquivo CSV/TXT/TSV previamente autorizado.
5. Marque a confirmação de autorização e clique em **Importar números**.
6. Confira quantidade de novos/repetidos/inválidos e exporte o CSV da origem escolhida.

O modelo `modelos/Modelo_Importacao_Autorizada.csv` pode ser aberto no Excel. Para importar arquivos XLSX, primeiro salve a aba de dados em CSV UTF-8.

## Garantias e limites
- Limite: 1.500 linhas, 110 KB por lote e 12 mil contatos nesta base.
- Telefones são normalizados e consolidados preservando as origens distintas.
- Os dados são armazenados somente em `dados/participantes-importados.json`; a pasta `dados/` é ignorada pelo Git.
- A importação **não concede autorização de publicidade**. Os contatos importados são separados dos contatos que confirmaram receber mensagens.
- Rotas protegidas pela autenticação administrativa. A exportação CSV neutraliza fórmulas maliciosas.
- Nenhuma mensagem é enviada. Não existe extração automática de integrantes do WhatsApp.
- Use `npm test` para executar os testes automatizados antes de qualquer implantação.
