# Caça Promos VIP — Leitor de tela v0.4 (experimental)

Versão de desenvolvimento do painel lateral do Chrome para **OCR local de imagem**.

## Pasta oficial única

`C:\projeto01\captacao\caca-promos-vip\extensao-lateral`

O leitor está dentro dessa pasta. Não existe outra cópia de projeto no disco C:.

## Como experimentar no ACER

1. Abra `chrome://extensions` e localize a extensão carregada a partir da pasta oficial. Clique em **Recarregar**.
2. Abra a página que deseja ler e deixe visível o trecho permitido.
3. Abra a lateral da extensão, marque a confirmação de autorização e pressione **Capturar tela visível**.
4. Se o Chrome impedir a captura, use **Ou selecionar uma imagem do computador** para escolher uma captura de tela salva.
5. Arraste o mouse sobre a imagem para selecionar somente o trecho relevante.
6. Clique em **Ler texto selecionado**. O OCR poderá levar alguns segundos.
7. Confira e corrija o conteúdo no campo **Texto reconhecido**. A leitura pode trocar ou omitir caracteres, especialmente números pequenos.
8. Use **Copiar texto**. Se necessário, clique em **Organizar contatos** e depois **Exportar CSV** para listas autorizadas.

### Comportamento e restrições

- Captura por clique, não monitoramento contínuo: nenhuma imagem é capturada ao abrir a extensão.
- A captura da aba pelo Chrome depende da permissão temporária `activeTab`, recebida quando a extensão é acionada pelo usuário. Em caso de erro, use a escolha manual de imagem.
- A imagem completa fica apenas em memória durante a seleção. O OCR reconhece somente o retângulo escolhido e descarta a imagem após apresentar o texto.
- O OCR é local: biblioteca Tesseract.js e modelo de português distribuídos em `ocr/`, sem CDN nem servidor remoto.
- Não acessa o conteúdo oculto, não lê APIs internas ou conversas do WhatsApp, não rola listas nem envia mensagens.
- Os textos e contatos identificados permanecem na memória do painel, até você limpar ou fechar a lateral.
- A interpretação dos números **não é garantida**. Revise os dígitos no texto antes de exportar.
- O CSV é opcional e exige a confirmação de autorização de registro. A importação não autoriza mensagens comerciais.
- OCR em língua portuguesa, com limite de até 30.000 caracteres no texto editável.
- Imagens escolhidas devem ser PNG, JPG ou WebP com até 12 MB.

### Estado da validação

- A leitura de imagem com texto fictício em página local foi validada no Chrome usando Playwright.
- O teste identificou três números fictícios após tratar pontuação comum que o OCR pode acrescentar; isso **não demonstra precisão perfeita** em imagens reais.
- Verificou-se que as solicitações de arquivos do motor OCR ficaram limitadas ao servidor de testes local.
- Os testes de normalização de recorte e carregamento local do motor foram aprovados.
- A execução de um teste carregando diretamente a extensão como `chrome-extension://` foi bloqueada pela ferramenta nesta sessão. Portanto, **a captura real por activeTab ainda requer teste manual no Chrome**.
- Testes legados da extensão v0.3 precisam ser atualizados antes de integrar esta versão à branch principal.

Os arquivos temporários de instalação (`ocr/.deps`) foram excluídos. Permanecem somente os arquivos locais necessários ao OCR e as licenças das bibliotecas.

## Referências técnicas

- Chrome Extensions — tabs.captureVisibleTab: https://developer.chrome.com/docs/extensions/reference/api/tabs/
- Tesseract.js local: https://github.com/naptha/tesseract.js
