# Etapa 52 - diagnostico supervisionado do Gerador de Links

Data: 2026-10-28
Branch de desenvolvimento: feat/etapa50-homologacao-segura (PR #49).
Estado: VERSAO DE DIAGNOSTICO AINDA NAO IMPLANTADA NO ACER.

## Confirmacoes no Acer

- Central 3030 e Captacao 3040: HTTP 200; envio automatico,
  monitores e filas inativos.
- Conector 02 na instalacao principal: manifest v0.4.3, arquivos
  iguais ao checkout anterior e path Chrome Profile 10 correto.
- Heartbeat com a Central existe, mas nao comprova a versao ativa
  do script na aba nem a elegibilidade do anuncio.
- Ultima tentativa real apos a Etapa 52 terminou com
  GENERATE_BUTTON_DISABLED, limpou o job e nao salvou oferta.
- O teste anterior da Etapa 51 gerou URL em formato oficial,
  mas destino e atribuicao permaneceram inconclusivos.
- Chrome do usuario nao foi reiniciado nem teve preferencias
  ou credenciais alteradas nesta verificacao.

## Melhorias propostas na branch isolada

Conector 02 v0.4.4: ao detectar Gerar desabilitado, captura apenas
indicadores estaticos: URL preservada ou divergente, input editavel,
validade HTML nativa, etiqueta selecionada ou pendente, tipo de bloqueio
do botao e existencia de alerta visivel. Nenhum valor do campo,
codigo de etiqueta, mensagem do portal ou token e transmitido.
Sem clique forcado, requisições novas, leitura de HTML completo
ou uso automatico de etiquetas arbitrarias.

Os testes do Chrome headless cobrem URL integral e anuncio individual,
sucesso com etiqueta unica, bloqueio com etiqueta pre-selecionada,
campo que perde a URL apos input, alerta com texto privado e
aria-disabled. Simulacoes nao homologam o Portal real.

## Como concluir sem arriscar envios

1. Revisar os testes no GitHub Actions e manter o PR em rascunho.
2. Se aprovado, preparar backup dos arquivos da extensao principal
   e copiar somente manifest e content.js da versao v0.4.4.
3. No Chrome do mesmo perfil, usuario recarrega o Conector 02.
   Reabrir a aba do Gerador para carregar o novo content script.
4. Escolher um unico anuncio individual novo e elegivel, usar sua URL
   integral da pagina oficial e etiqueta ja existente. Conferir
   se o botao habilita com a mesma URL colada manualmente.
5. No teste supervisionado TESTE_LINK_SEM_ENVIO, registrar apenas
   os codigos do diagnostico. Se Gerar continuar desabilitado,
   nao insistir nem burlar: distinguir restricao do portal e
   abrir suporte oficial, se necessario.
6. Somente com link gerado, conferir HTTPS, destino e programa;
   sem compra e sem declarar comissao comprovada.
7. Manter monitores e envios do WhatsApp desligados.

## Verificacao das regras de divulgacao

Mercado Livre orienta compartilhar links apenas em canais permitidos,
inclusive grupos PUBLICOS e canais declarados; a documentacao de
boas praticas alerta contra grupos privados e chats fechados.
Antes de liberar WhatsApp, verificar se o grupo VIP e um canal
permitido no programa do usuario. Um destino privado nao deve ser
considerado habilitado para comissao sem confirmacao oficial.

Documentacao oficial:
https://www.mercadolivre.com.br/l/afiliados-primeiros-passos
https://www.mercadolivre.com.br/l/boas-praticas-links
https://www.mercadolivre.com.br/l/checklist

## 28/10/2026 — Erro ao recarregar Conector 02

Captura do usuario: `Uncaught (in promise) Error: Extension context
invalidated` em `content.js:65`, chamada `chrome.runtime.sendMessage`
na aba `/afiliados/linkbuilder#hub` apos clicar Recarregar na extensao.

Causa compativel: o content script anterior permanece na aba, mas
o Chrome invalida o runtime do script ao recarregar o pacote.
Nao demonstra problema de autenticacao ou da API Mercado Livre.

Correcao v0.4.5: verifica `chrome.runtime.id`, envolve chamadas e
callbacks de `sendMessage` em try/catch, trata Promise rejeitada,
interrompe o temporizador do content script antigo e nao prossegue
no job apos invalidacao. Simulacoes cobrem erro sincronico,
erro no callback, rejeicao da Promise e runtime sem ID;
sem mensagens ao backend nem envios WhatsApp.

O usuario precisa atualizar a aba do Gerador (`Ctrl+R`) depois
de recarregar a extensao; erros historicos permanecem na tela do
Chrome ate limpeza manual. Nao editar arquivos internos do Chrome.
Ainda faltam teste real do gerador e homologacao de atribuicao.
