# Caça Promos VIP — Painel lateral v0.3.0

Extensão Chrome Manifest V3 para organizar nomes e telefones **fornecidos com autorização individual**.
O painel roda localmente e exporta CSV compatível com a área de importação da Central de Captação.

## Onde fica a extensão (pasta única no ACER)

`C:\projeto01\captacao\caca-promos-vip\extensao-lateral`

No Chrome, abra `chrome://extensions`. Recarregue a extensão já instalada por essa pasta.
Se ainda estiver vinculada ao caminho antigo, remova essa instalação e use
**Carregar sem compactação** para escolher a pasta oficial acima.

## Como usar

1. No WhatsApp Web, abra o grupo autorizado e a janela **Pesquisar membros**.
2. Selecione **manualmente** o texto com nomes e telefones visíveis e pressione `Ctrl+C`.
   Não precisa copiar cada número individualmente.
3. No painel da extensão, informe opcionalmente o nome do grupo e confirme que as
   pessoas listadas autorizaram o registro de seus dados para essa finalidade.
4. Clique em **Importar texto copiado**. A leitura da área de transferência só
   acontece após esse clique.
5. Para adicionar mais pessoas, role manualmente a lista no WhatsApp Web, selecione
   o novo trecho, copie e clique novamente. Números repetidos não entram duas vezes.
6. Confira a prévia mascarada e clique em **Exportar CSV**.
7. Na Central de Captação, selecione o grupo de origem, registre a referência das
   autorizações individuais e importe o CSV.

Se o navegador não permitir ler a área de transferência ou a lista não permitir
selecionar texto, use **Ou colar a lista manualmente** para revisar registros obtidos
por meios autorizados. Não existe modo de leitura automática do popup nessa versão.

## Formato

- CSV UTF-8 com cabeçalho `nome;telefone`, compatível com a Central.
- Telefones brasileiros saem normalizados com código do país (ex. `5511988887777`).
- Telefones internacionais válidos mantêm o prefixo `+`; sua compatibilidade com
  Excel e a Central deve ser conferida antes de importar.
- Um nome exibido na linha imediatamente anterior ao telefone é associado quando
  a correspondência é inequívoca; confira manualmente os nomes antes de usar.
- Nome do grupo, se preenchido, aparece somente no nome do arquivo.
- Limite de 1.500 linhas ou 110 KB por leitura; múltiplas leituras acumulam sem repetição.

## Privacidade e limitações

- A extensão solicita as permissões `sidePanel` e `clipboardRead`.
- Ela **não** lê o DOM do WhatsApp, não acessa conversas nem percorre grupos.
- Não captura telefones apenas pelo fato de você ter aberto o WhatsApp Web.
- Não rola a lista sozinha, não coleta membros ocultos, não envia mensagens e não
  transmite contatos para servidores.
- Os contatos permanecem em memória na lateral até você limpar ou fechar o painel.
- O registro de um telefone **não** é permissão para enviar mensagens comerciais.

## Testes

A partir da pasta `extensao-lateral`:

```powershell
node --test tests\parser.test.mjs tests\painel.test.mjs
node --check extractor-core.js
node --check sidepanel.js
```

Os testes automatizados usam dados fictícios e simulam o clique de importar texto
copiado e a exportação CSV. O teste visual completo no Chrome ainda não foi
concluído nesta sessão; será necessário recarregar a extensão e verificar
a permissão do clipboard no navegador.
