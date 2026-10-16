# Caça Promos VIP — Painel de participantes v0.4.1

Nova função **Ler participantes visíveis**: a extensão examina, mediante clique,
somente os textos que o WhatsApp Web já renderizou dentro do popup
**Pesquisar membros**. O operador revisa o texto e, quando tiver a autorização
necessária, pode organizar nomes e telefones e exportar CSV local.

## Localização no ACER

Pasta oficial única:
`C:\projeto01\captacao\caca-promos-vip\extensao-lateral`

Não criar novas pastas de projeto a cada versão.

## Como testar no Chrome

1. Abra `chrome://extensions` no ACER e clique em **Recarregar** na extensão instalada dessa pasta.
2. Entre em `https://web.whatsapp.com`, abra o grupo autorizado e o popup **Pesquisar membros**.
3. Clique no ícone da extensão para abrir a lateral, marque a confirmação de autorização e clique em **Ler participantes visíveis**.
4. O texto que estiver efetivamente visível naquele popup aparecerá no campo **Texto encontrado**. Confira os nomes e os telefones.
5. Se quiser acrescentar novos membros exibidos após uma rolagem, role o popup **manualmente** e clique novamente.
6. Clique em **Organizar contatos** para normalizar números e eliminar duplicações. Revise os resultados.
7. Use **Exportar CSV** para obter a planilha UTF-8 `nome;telefone`. Na Central de Captação, selecione o grupo de origem e registre a referência das autorizações individuais.

### Se o leitor não identificar o popup

- Verifique se a aba ativa é o WhatsApp Web e se o título `Pesquisar membros` está aberto.
- Abra a extensão **pelo ícone do Chrome** naquela aba: isso concede acesso temporário (`activeTab`) quando necessário.
- Recarregue a extensão após atualizar o código. O Chrome pode solicitar aprovação da nova permissão `scripting`.
- O WhatsApp muda sua interface com frequência; seletores internos podem exigir manutenção.
- Como alternativa, use **Captura de tela com OCR** e selecione manualmente a região a reconhecer.

## Segurança e limites

- Permissões declaradas: `sidePanel`, `activeTab`, `scripting`. Não há acesso permanente a sites nem script rodando em segundo plano.
- O script da página verifica a origem `https://web.whatsapp.com` e exige o título do popup.
- Os textos devem estar visíveis no viewport e dentro da área efetivamente mostrada: elementos ocultos, fora da rolagem e conversas externas não são retornados.
- Não percorre membros ocultos, não realiza rolagem automática, não abre chats, não usa APIs internas, não acessa cookies, não envia mensagens e não transmite dados.
- A leitura começa apenas quando o operador clica no botão. Os textos permanecem na memória do painel, sem armazenamento permanente.
- A lista é revisável e pode conter nomes, rótulos e números. O CSV só é produzido mediante ação posterior.
- A captura OCR alternativa roda localmente com Tesseract.js e pode reconhecer caracteres incorretamente.
- A coleta de telefones **não equivale a consentimento para receber mensagens comerciais**; mantenha as autorizações individuais documentadas.

## Testes com dados fictícios

Executados:
- Teste do leitor numa página simulada, incluindo nomes, telefones, elementos ocultos, chat externo e rolagem manual.
- Teste do botão no painel com API de extensões simulada, confirmação de autorização, duas leituras e exportação CSV.
- Testes Node de normalização, controle de consentimento e motor OCR.
- O teste do leitor com o WhatsApp Web real **ainda depende de validação manual** por quem tem acesso à sessão.

Comandos para repetir no ACER:

```powershell
cd C:\projeto01\captacao\caca-promos-vip\extensao-lateral
node --test
node tests\popup-visivel-browser.mjs
node tests\popup-panel-browser.mjs
```

## Referências técnicas

- Chrome Scripting API: https://developer.chrome.com/docs/extensions/reference/api/scripting
- Permissão temporária activeTab: https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
- OCR local alternativo: https://github.com/naptha/tesseract.js
