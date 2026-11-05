# Automação do Gerador de Links Mercado Livre

Esta extensão local roda **somente no navegador do usuário** e usa a sessão já autenticada no Portal de Afiliados.

Ela não acessa cookies, tokens ou credenciais. O trabalho é feito pelo DOM visível do Gerador de Links oficial:

1. o painel cria um pedido contendo a URL do produto;
2. a extensão abre/localiza **Gerador de Links**;
3. preenche a URL;
4. clica em **Gerar**;
5. captura o link oficial `meli.la` ou `/sec/`;
6. devolve o link para `http://127.0.0.1:3030`;
7. o backend valida e salva o link na oferta atual.

## Instalação (uma vez)

1. Abra `chrome://extensions/`.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione:
   `C:\projeto02\browser-extension\mercadolivre-affiliate` (instalação do Acer)
5. Mantenha a extensão habilitada.
6. Atualize o painel `http://localhost:3030`.

O painel passa a mostrar **Automação Meli conectada**.

Se o Mercado Livre alterar o layout do Portal, o fluxo manual continua disponível como fallback.

## Conector 0.4.6 e diagnósticos do botão desabilitado

- Se **Gerar** estiver desabilitado pelo próprio portal, a extensão não clica à força, não elimina o atributo disabled e não inventa link de afiliado.
- Seletores personalizados de etiqueta passam a ser classificados como `ETIQUETA_CUSTOM_VISIVEL_NAO_VERIFICADA`: visualizar uma etiqueta NÃO prova que o portal a aceitou ou que o anúncio está elegível.
- O aviso na página é curto, legível e não estoura a tela. Diagnóstico técnico completo fica no console da Central. Nenhum valor de etiqueta ou token é enviado no diagnóstico.
- A busca de ofertas passou a validar o estoque e a página do **anúncio específico** na API do Mercado Livre. A aprovação pelo Programa de Afiliados continua a cargo do portal oficial.
- Para carregar o conector depois de atualizar o arquivo, abra `chrome://extensions/`, recarregue a extensão **Conector 02** e atualize a aba do Gerador de Links. Não faça isso durante um pedido/link em andamento.


## Cupons

A partir da versão 0.3.0, a extensão também observa blocos de cupom que estejam visíveis em páginas do Mercado Livre/Afiliados e envia apenas esses blocos para o painel local.

Ela não envia o conteúdo geral da página, cookies, senhas ou tokens.

Os cupons observados têm validade curta no cache do projeto e são revalidados antes da preparação no WhatsApp. Para carregar esta versão após um `git pull`, recarregue a extensão em `chrome://extensions/`.
