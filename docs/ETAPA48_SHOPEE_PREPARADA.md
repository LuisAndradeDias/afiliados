# Etapa 4.8 — Shopee integrada à Central do Afiliados 2.0

Data: 2026-10-26. Base: PR #45. Branch: feat/shopee-painel-integrado-etapa48.

## Decisão do proprietário

A Shopee será uma **terceira plataforma na mesma Central** com Amazon e Mercado Livre.
Quando a conta e integração forem aprovadas, as promoções deverão usar **o mesmo
grupo de WhatsApp já configurado**. Nenhum segundo grupo, perfil ou sessão.

## O que está pronto agora

- `/central`: módulo e entrada Shopee, sem reduzir ou remover ferramentas existentes.
- `/ofertas`: navegação Shopee, status visual e título da plataforma unificada;
  o ciclo automático existente continua **Amazon + Mercado Livre**, sem Shopee nas filas.
- `/shopee`: página minimalista de alto contraste com estados de conta/API,
  acesso ao portal Shopee, orientações e formulário real para links manuais.
  Responsiva (desktop e celular), com focos visíveis e status acessíveis.
- `GET /api/shopee/status`: informa de forma honesta `conta=aguardando`,
  `apiAtiva=false`, `envioAutomatico=false`, `mesmoGrupoFuturo=true`.
- `GET/POST/DELETE /api/shopee/rascunhos`: cadastro e gestão de links **já
  convertidos pelo próprio usuário no portal Shopee**, em rascunho local.
- Armazenamento: `data/shopee-rascunhos.json` no diretório do programa, JSON
  versionado por schema, IDs UUID, escrita atômica, máximo de 100 rascunhos.
- Validação de URL HTTPS Shopee, rejeição de domínios impostores, protocolos
  inseguros, credenciais na URL, duplicidade, dados excessivos, preços inválidos
  e links sem confirmação explícita de conversão.
- POST/DELETE requerem origem HTTP local correspondente, sem CORS e negam
  tentativas cross-site. O cliente monta DOM com `textContent`, evitando
  HTML injetado por títulos ou links.

## O que NÃO está habilitado

- A conta de Afiliados Shopee ainda não existe; nenhuma comissão é exibida
  como fato, nenhum valor de desconto é inventado.
- App ID, Secret e Open API não foram cadastrados/testados; o botão de busca
  automática fica desabilitado, sem chamadas externas.
- **Nada entra na fila do WhatsApp:** nem ofertas, nem links manuais; salvar
  ou copiar rascunho não acessa o robô, a sessão nem o grupo.
- Não há credenciais em GitHub, Google Drive ou bancos. PostgreSQL continua
  fora do projeto.
- Não modificar os padrões `MIN_DISCOUNT_PERCENT=25` e regras de reputação
  do Mercado Livre/Amazon.

## Como utilizar quando a conta Shopee for aprovada

1. No ACER, abrir `http://127.0.0.1:3030/shopee`.
2. No Portal de Afiliados da Shopee, usar a opção de **Link de Conversão**
   para gerar um link de produto/loja já associado à sua conta. A ferramenta
   oficial também aceita Sub_id para rastrear a origem.
3. Colar o link convertido, título e, opcionalmente, preço atual na página
   Shopee; confirmar que é de afiliado; clicar **Salvar rascunho**.
4. O rascunho ficará exclusivamente no C: local. Pode ser copiado ou
   excluído manualmente, sem enviar ao grupo.
5. Quando a API de afiliados for oficialmente liberada, confirmar endpoint,
   contratos, autorização e gestão segura do App ID/Secret; só então conectar
   busca e geração oficial de links, com testes isolados.
6. Por último, integrar a fila **existente** do mesmo grupo, com revisão,
   consentimento, controle de duplicidade, intervalos e sem envios de teste
   não autorizados.

## Origem documental

- Central de Ajuda Shopee Brasil: gerar links de afiliado pelo aplicativo e
  computador: https://help.shopee.com.br/portal/10/article/128461
- Central de Ajuda Shopee Brasil: Sub_id rastreamento e links:
  https://help.shopee.com.br/portal/10/article/127556

## Verificações no ACER em worktree separada

- Diretório de desenvolvimento isolado: `C:\afiliados-v2-shopee-v1`,
  sem `.env` nem dados privados; base PR #45.
- TDD RED observado antes de implementar os arquivos de serviço/rotas/UI.
- Testes Shopee: **12/12 aprovados** (URLs, armazenamento, segurança HTTP,
  status, página, navegação e proteção dos motores antigos).
- TypeScript aprovado.
- Navegador Chrome em `http://127.0.0.1:3130/shopee`, monitores desligados:
  desktop 1440px e celular 390px sem rolagem horizontal e sem erros JS.
- Criar rascunho manual fictício no navegador, listar e excluir: **aprovado**,
  contagem final 0; sem mensagens enviadas.
- Segurança da Central anterior e contratos Mercado Livre são testados
  novamente na CI Windows/Linux.
- PR draft #46 empilhado sobre PR #45. Revisão independente antes de merge.

## Implantação

Somente instalar no painel 3030 após verificar o status do monitor e fazer
backup protegido no disco C:. Substituir apenas arquivos da UI e o roteador
local Shopee, preservar `C:\projeto01`, portas 3040/3045, .env, perfis,
contatos, grupo e filas. Não iniciar automação.
