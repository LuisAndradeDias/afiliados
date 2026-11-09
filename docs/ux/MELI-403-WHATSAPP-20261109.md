# 09/11/2026 — Diagnóstico MELI HTTP 403 e WhatsApp automático sem envio

## Sintomas confirmados (log real, produção Acer)

- Monitor intercalado ativo; a busca Mercado Livre iniciou às 15:50:47.
- `/products/search` encontrou candidatos; `GET /items/MLB4709979065` respondeu **HTTP 403** às 15:50:51. O buscador saiu com código 4 e a Central iniciou bloqueio temporário para essa fonte. Não foram gerados dados de anúncio/afiliado falsos. A causa exata da política de autorização ainda exige resolução com suporte/DevCenter; grant com 17 scopes não prova acesso a anúncios de terceiros.
- Amazon encontrou uma oferta e gerou imagem às 15:52:27. WhatsApp Web abriu na tela; a pesquisa do grupo falhou às 15:54:46, depois novamente às 15:57:24; ambas antes da composição ou envio.
- O código antigo aguardava sequencialmente quatro seletores por 30 segundos cada. O primeiro seletor era o único compatível com o campo de texto atual. No Chrome real, esse campo precisou de **35.556 ms** para ficar disponível: chegava depois da janela de espera do seletor correto.
- Inspeção de resultados de pesquisa no perfil real, **sem envio e sem abrir conversa**, confirmou: campo real `<input role="textbox" data-tab="3">` dentro de `[data-testid="chat-list-search-container"]`. O grupo configurado foi encontrado por nome visível EXATO em `#side`, mas não por `title` (0 matches title, 1 match text). O método antigo procurava apenas `title`, logo falharia novamente na etapa seguinte.
- O estado final pré-correção conservava oferta Amazon preparada, autoenvio configurado, monitor ativo, nenhum trabalho executando, sem mensagem enviada nessa execução. Não apagar a oferta nem mexer em histórico/autorização.

## Ajuste focalizado em branch de desenvolvimento

- `src/robo/whatsapp-busca.ts`: aguardar todos os layouts válidos numa única busca com até 90 s. Nunca incluir compositor de mensagens nos candidatos.
- Grupo: localizar texto exato somente em `#side`, inclusive quando `title` foi removido. Não usar buscas por substring que possam selecionar nomes semelhantes.
- Fail-closed: após abrir grupo, conferir nome exato no cabeçalho `#main header` antes de preparar o envio; se DOM mudou, não publicar.
- `src/robo/whatsapp-preparar.ts`: usa funções novas, e o modo de teste contém campo `input` atual e cabeçalho sintético.
- `tests/whatsapp-busca-resiliente.mts` e `tests/whatsapp-preparar-ficticio.mts`: layouts novos/antigos, atraso, ausência de busca, nomes próximos, texto fora da lista, cabeçalho errado, fluxo fictício completo (sem chamada de envio).
- `npm run test:whatsapp-busca` agregado ao CI.
- Não desativar validação de destino MELI nem autorização do grupo público; não alterar delay do autoenvio; não enviar mensagens reais de teste.

## 403 — não confundir com problema do WhatsApp

- Requisições a `/items/{id}` podem exigir permissões funcionais e políticas adicionais; conferir [Permissões funcionais](https://developers.mercadolivre.com.br/pt_br/produto-autenticacao-autorizacao/permissoes-funcionais).
- O erro não é um sinal de estoque esgotado ou ausência de promoções. Não reinterpretar 403 como preço zero; nem voltar a consultar indefinidamente o mesmo item para contornar o bloqueio.
- Priorizar fontes e endpoints autorizados, registrando cotações verificáveis em histórico separado e mantendo as ofertas proibidas para revisão assistida. Nenhum envio MELI a canal privado/sem confirmação.
- Esta correção do WhatsApp **não libera o acesso à API** do Mercado Livre. O monitor MELI permanece limitado enquanto a política responder 403.

## Controle para implantação

- Aplicar apenas após GitHub Actions verde, backup hash e sem tarefa de WhatsApp ativa ou mensagem sendo enviada. Como já existe uma oferta preservada e monitor ligado, não descartá-la automaticamente para facilitar deploy.
- Conferir versão de produção e perfil Chrome existente; nenhum dado de contato, token, nome de grupo ou sessão deve entrar em Git.
- QA final da correção somente com perfil existente e busca visual, sem clicar Enviar; depois de implantar, um teste real de postagem deve ocorrer apenas com canal autorizadamente configurado e consentimento do operador.
