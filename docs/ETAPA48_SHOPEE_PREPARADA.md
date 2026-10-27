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

## Implantação controlada no ACER — 27/10/2026

**Concluída somente na instalação de homologação:** `C:\afiliados-v2-homologacao`, porta 3030. Esta operação **não** foi um merge dos PRs empilhados nem ativou ofertas Shopee automáticas.

O ACER havia reiniciado às 08h06 e as portas 3030/3040 estavam fechadas. Verificamos ausência de tarefas/sinais de envio, `.env` com as flags `ALTERNATING_MONITOR_ENABLED=false`, `MERCADOLIVRE_MONITOR_ENABLED=false` e `WHATSAPP_AUTO_SEND_ENABLED=false`. Antes da instalação, os seis arquivos existentes eram idênticos aos blobs do commit-base `037c507c21527305984b58ca229cf63489a574b9`.

1. Backup local em `C:\BackupsAfiliados\2026-10-27_antes-etapa48_SHOPEE`, ACL protegida; seis originais verificados por SHA-256 e blob Git. Script de implantação e rollback `INSTALAR_ETAPA48_SEGURO.ps1` sintaticamente validado e guardado junto ao backup.
2. Instalados somente onze arquivos da UI/rotas/rascunhos da Shopee com blobs exatos do commit `f6dd9d1eba7c35b16a0ffd307079bb050ce258e5` (seis substituídos, cinco novos). Sem cópia de `.env`, sessão Chrome, contatos ou histórico.
3. `npm.cmd run typecheck` passou na própria instalação; Central, Ofertas, Shopee, CSS/JS e endpoints GET em localhost:3030 retornaram HTTP 200. `/api/shopee/status` confirma `conta=aguardando`, `apiAtiva=false`, `envioAutomatico=false` e grupo existente indicado apenas como destino futuro.
4. Captação foi reiniciada em localhost:3040, usando seu diretório de dados existente, sem acionar o worker de WhatsApp. GET `/saude`, `/campanhas`, `/enviar` retornaram HTTP 200.
5. Chrome/Playwright real diretamente em `http://127.0.0.1:3030/shopee`: desktop 1440px e mobile 390px, sem overflow/erros; cadastro de link fictício, listagem e exclusão com contador final zero; navegação Shopee na Central e Ofertas OK. Nenhuma mensagem enviada.

**Rollback:** instruções e seis arquivos originais guardados no diretório protegido indicado acima. O rollback real não foi necessário; a verificação de hashes antecedeu a troca. Instalação antiga `C:\projeto01` preservada. Relatório de execução: `C:\afiliados-v2-homologacao\diagnosticos-local\DEPLOY_ETAPA48_SHOPEE.txt`.

**Pendente:** revisão e integração segura da cadeia PRs #38–#46, aprovação da conta Shopee, liberação da Open API e integração futura da fila supervisonada com o **mesmo grupo**. Não instalar PostgreSQL, não usar Drive e não iniciar envios sem autorização.
