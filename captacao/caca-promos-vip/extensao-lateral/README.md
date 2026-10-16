# Caça Promos VIP — Painel lateral v0.2.1

Extensão Chrome Manifest V3 para organizar **telefones fornecidos com autorização**.
O projeto inclui um painel lateral escuro, com visual minimalista da marca, revisão de números, deduplicação e CSV local.

## Como abrir no ACER

1. No Chrome, entre em `chrome://extensions`.
2. Ative **Modo do desenvolvedor**.
3. Se a extensão antiga já estiver instalada por essa mesma pasta, clique em **Atualizar/Recarregar** no cartão dela.
4. Caso contrário, clique em **Carregar sem compactação** e escolha esta pasta `extensao-lateral`.
5. Abra o WhatsApp Web e clique no ícone do **Caça Promos VIP** na barra de extensões: o painel abrirá na lateral direita.

## Como usar

1. Abra manualmente as informações de um grupo que permite essa finalidade.
2. Copie apenas os números visíveis dos participantes que autorizaram o registro.
3. Cole os números no campo do painel lateral, um por linha (podem estar junto de nomes).
4. Marque a declaração de autorização individual e clique em **Conferir números copiados**.
5. Revise o total e as duplicações. Clique em **Exportar CSV**.
6. Na Central de Captação v0.5, escolha **Importar** e selecione o grupo de origem, declarando a referência das autorizações individuais. Importe o CSV gerado.

**Limite:** 1.500 linhas e 110 KB por revisão.

## O que a extensão faz e não faz

- Não lê a árvore de elementos (DOM) do WhatsApp e não inspeciona conversas.
- Não varre grupos, não procura números ocultos, não rola a lista e não envia mensagens.
- Não envia dados para servidores, não usa rede, nem armazena números de modo permanente.
- O operador cola o texto explicitamente; a prévia fica apenas em memória e desaparece quando o painel é fechado.
- A análise aceita telefones brasileiros e internacionais com + e elimina duplicatas.
- O CSV possui colunas `nome;telefone` para importação pela Central (o grupo é selecionado na Central).
- A permissão **sidePanel** é a única permissão de extensão solicitada.
- **A captura automática da lista de participantes ainda não foi implementada.** O protótipo antigo citava `extractor-core.js` e `collector.js` ausentes; na versão atual esse caminho foi substituído por um fluxo manual funcional e honesto.

## Testes

Execute na pasta `extensao-lateral`:

```powershell
node --test .\tests\parser.test.mjs
node --check sidepanel.js
node --check background.js
```

Versão mínima do Chrome: 116. O Chrome pode exigir que você recarregue a extensão ao alterar o manifest.
