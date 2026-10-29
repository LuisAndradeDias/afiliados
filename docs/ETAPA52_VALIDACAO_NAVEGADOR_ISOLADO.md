# Etapa 52 - verificacao de destino via Chrome isolado

Data: 28/10/2026. PR #49 em rascunho.

## Problema confirmado

Em 28/10, o Conector 02 v0.4.5 conseguiu criar um link de formato
oficial para MLB38053317, sem erros da extensao. O verificador
HEAD/GET sem cookies retornou `inconclusivo`, motivo
`NO_HTTP_REDIRECT`, pois nao observou um redirect HTTP util.
Esse resultado **nao reprova nem comprova** o link.

O teste anterior descarta o URL tecnico imediatamente, para evitar
persistir parametros de rastreamento do programa de afiliados.
Nao e apropriado gravar esse URL no painel ou em arquivos de log.

## Implementacao experimental

Novo validador opt-in `src/afiliados/mercadolivre-destino-navegador.ts`:

- Somente job manual `mercadolivre-link-diagnostico`, com confirmacao
  `TESTE_LINK_SEM_ENVIO` e preflight operacional integralmente seguro.
- Novo campo `verificarDestinoNavegador` assume `true` somente
  na chamada explicita ao diagnostico supervisionado.
- Recebe a URL diretamente em memoria do recebimento do Conector;
  nao a grava no job, nos logs, no historico de ofertas ou nos testes.
- Cria Chrome headless temporario, com contexto novo, sem perfil
  persistente e sem usar cookies, extensoes ou credenciais do usuario.
- Permite apenas HTTPS, GET/HEAD, host oficial Mercado Livre/meli.la
  e assets mlstatic em subrecursos. Bloqueia caminhos de carrinho,
  compra, pagamento e checkout; bloqueia hosts externos e outras
  operacoes HTTP. Limita navegacoes e tempo.
- Nao executa compras, capturas de tela, acesso a WhatsApp nem
  transferencias para terceiros fora do site acessado.
- Confirma somente se o URL final ou canonical de uma pagina
  oficial HTTP 2xx identifica inequivocamente MLB38053317.
- ID final diferente retorna divergente. Ausencia de evidencias,
  bloqueio, intersticial e HTTP 403 retornam inconclusivo.
- Somente resultado tecnico sem URLs ou parametros:
  `NAVEGADOR_CATALOGO_CORRESPONDENTE`,
  `NAVEGADOR_CATALOGO_DIVERGENTE`,
  `NAVEGADOR_SEM_ID_CATALOGO`,
  `NAVEGADOR_RESPOSTA_NAO_CONFIRMADA`,
  `NAVEGADOR_DESTINO_EXTERNO_BLOQUEADO`, etc.
- `atribuicaoComprovada` permanece sempre `false`.
- Limpeza do job temporario e estado pausado mantidos.

## Execucao supervisionada

Apos testes de CI, backup verificado, implantacao restrita e
reinicio controlado da Central, usar UMA unica vez:

`powershell.exe -NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File C:\projeto02\scripts\etapa50\diagnosticar-url-manual.ps1 -UrlProduto "https://www.mercadolivre.com.br/parafusadeira-e-furadeira-impacto-the-black-tools-tb-21pw-38-cor-amarelo-frequencia-5060-hz/p/MLB38053317" -ConfirmarTesteManual -VerificarDestinoNavegador`

Nao combinar com `-VerificarDestino`; sao modos alternativos.
Registrar apenas status, motivo sanitizado e condicoes finais.

## Regras de aprovacao

- Mesmo com `destino=confirmado`, isso prova apenas o catalogo visto
  em navegacao isolada: **nao** comprova comissao, conta elegivel,
  canal permitido, estoque, preco, cupom ou envio.
- Nunca aprovar uma oferta automaticamente com base no teste tecnico.
- Se o navegador receber desafios anti-bot ou exigir login,
  classificar como `inconclusivo`. Nao usar tecnicas para contornar.
- Antes da divulgacao, confirmar nos canais e relatorios oficiais
  do programa a elegibilidade e a atribuicao permitida.
- WhatsApp, monitores, filas e ofertas continuam inativos.
- PR #49 nao deve ser mesclado nem envios liberados
  antes de homologacao comercial e rollback aprovado.
