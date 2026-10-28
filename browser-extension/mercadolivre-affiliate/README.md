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
   `C:\projeto02\browser-extension\mercadolivre-affiliate`
5. Confira que a extensão nova aparece com o nome discreto **Conector 02**.
6. Mantenha a extensão habilitada e atualize o painel `http://localhost:3030`.

O painel passa a mostrar **Automação Meli conectada** após receber o ping da extensão. **Esse ping não comprova que o caminho no Chrome está correto nem que o Gerador de Links funcionou.**

Se o Chrome ainda mostrar uma extensão carregada de `C:\projeto01`, remova **somente a extensão local Meli antiga** e carregue novamente a pasta de `C:\projeto02` indicada acima. Faça isso no mesmo perfil do Chrome onde usa o Mercado Livre, sem excluir o perfil do navegador. Não altere manualmente o arquivo `Secure Preferences` nem apague cookies ou sessões.

Se o Mercado Livre alterar o layout do Portal, o fluxo manual continua disponível como fallback.


## Cupons

A partir da versão 0.3.0, a extensão também observa blocos de cupom que estejam visíveis em páginas do Mercado Livre/Afiliados e envia apenas esses blocos para o painel local.

Ela não envia o conteúdo geral da página, cookies, senhas ou tokens.

Os cupons observados têm validade curta no cache do projeto e são revalidados antes da preparação no WhatsApp. Para carregar esta versão após um `git pull`, recarregue a extensão em `chrome://extensions/`.


## Botao Gerar desabilitado mesmo com etiqueta selecionada

Se a etiqueta ja esta selecionada no Gerador oficial e o botao
**Gerar** continua cinza, nao crie outra etiqueta automaticamente.
Primeiro verifique se a URL e de uma pagina individual de produto
com anuncio ativo e elegivel. O codigo de catalogo /p/MLB...
pode aparecer como ativo na API, mesmo quando o endpoint de
anuncios /products/{id}/items responde HTTP 404.

A versao **Conector 02 v0.4.2** reconhece os caminhos oficiais
/p/MLB... e /MLB-12345-..._JM, mostra mensagens sem acentos
corrompidos e nao indica que falta etiqueta quando nao ha prova.

Apos atualizar os arquivos, acesse chrome://extensions e use
**Recarregar** somente no cartao Conector 02. Isso nao apaga
cookies ou sessoes. Depois teste manualmente uma URL copiada
da pagina real do anuncio; nao ative monitoramento ou autoenvio
antes de confirmar link oficial valido.

## Ajuste de URLs de produtos completos (Conector 02 v0.4.3)

No teste tecnico, preservar o caminho completo que aparece na
barra do navegador, por exemplo:
https://www.mercadolivre.com.br/parafusadeira-e-furadeira-impacto-the-black-tools-tb-21pw-38-cor-amarelo-frequencia-5060-hz/p/MLB38053317

Os parametros e fragmentos de rastreamento sao retirados, mas
o nome no caminho nao deve ser removido para o Gerador de Links.
O modo manual nao cria ofertas, nao altera etiquetas e nao publica
links no WhatsApp. Um eventual link tecnico gerado nao e uma
aprovacao para divulgacao.

Apos atualizar os arquivos, abra chrome://extensions, clique em
Recarregar no cartao Conector 02, e mantenha o mesmo perfil logado.
Acoes futuras devem continuar exigindo validacao real de estoque.
