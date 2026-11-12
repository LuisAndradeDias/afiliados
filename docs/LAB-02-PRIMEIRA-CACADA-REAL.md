# LAB-02 - Primeira Cacada Real: prova de acesso (12/11/2026)

## O que buscamos comprovar

O LAB-01 classificou produtos ficticios, mas nao descobriu produtos de verdade. O LAB-02 tem uma finalidade mais restrita: testar uma integracao oficialmente concedida que permita buscar produtos por palavra-chave.

**Resultado atual no Acer: acesso nao habilitado.** Encontramos configuracoes de pesquisa de navegador e tag do Programa de Associados da Amazon, mas nao encontramos credenciais da Creators API. Tampouco encontramos credenciais de Open API dos Afiliados Shopee.

Nenhuma pesquisa real foi realizada. Nao confundir API preparada com API homologada.

## Escolha de fonte

### Shopee: prioridade do teste

- Portal oficial com entrada Open API: https://affiliate.shopee.com.br/open_api
- Existe uma documentacao publica de terceiros em https://www.affiliateshopee.com.br/documentacao. Ela mesma declara que NAO e oficial. Descreve GraphQL productOfferV2, assinatura SHA256 e um endereco de API pertencente ao dominio da Shopee.
- A sonda existente usa essa descricao **provisoriamente**, mas recusa executar enquanto o operador nao confirmar o esquema no material oficial da propria conta e a permissao de uso dos dados.
- Limites: apenas uma requisicao manual, cinco produtos no maximo, URL da API fixa, sem paginacao, sem agendamento, sem WhatsApp e sem publicacao. 401/403 e 429 encerram a execucao sem tentar driblar o bloqueio.
- Uma resposta retorna somente candidatos. Nao comprova estoque, desconto, aplicabilidade de cupom, frete ou preco de checkout.

### Amazon: restricao documentada

- Operacao oficial de busca SearchItems: https://associados.amazon.com.br/creatorsapi/docs/en-us/api-reference/operations/search-items
- Regras de elegibilidade e credenciais: https://associados.amazon.com.br/creatorsapi/docs/en-us/onboarding/register-for-creators-api
- Termos oficiais (Brasil): https://associados.amazon.com.br/help/operating/policies
- A politica requer autorizacao expressa, previa e por escrito para determinados usos envolvendo agregacao e analise de Conteudo Publicitario de Produtos. O limite de cache de conteudo nao imagem e, em regra, de 24 horas, com outras exigencias de atualizacao e exibição.
- **Nao alimentar o historico de precos Amazon de 30 dias sem aprovacao especifica.** Uma tag de Associado nao substitui credenciais e permissoes da Creators API.
- O LAB-02 nao chama a Amazon.

### Mercado Livre

No protocolo de suporte 494444122, foi informado que o Programa de Afiliados nao disponibiliza API para buscar produtos. Continua bloqueada a descoberta automatizada de terceiros via Mercado Livre; mantemos apenas curadoria assistida.

## Modulos efetivamente criados

- labs/fonte-real/sonda.ts: verificacao de habilitacao, assinatura provisoria Shopee, uma query, verificacao de dados com rejeicao de respostas inadequadas.
- labs/fonte-real/cli.mts: leitura de status sem rede; modo buscar exclusivamente manual. Nao exibe nem grava tokens ou secrets.
- tests/lab02-fonte-real.mts: 16 testes de seguranca, recusa 401/403/429, limites, integridade, assinatura simulada e dados.
- .env.lab02.example: modelo sem credenciais reais; .env.lab02 e ignorado pelo Git.
- CI do GitHub: os novos testes fazem apenas chamadas simuladas e auditoria local de bloqueio.
- Nao foram alterados src/painel, src/robo, WhatsApp, env de producao, banco, monitor ou C:\projeto02.

## Como verificar na branch de laboratorio

1. npm run lab02:status - verifica as fontes, sem chamadas externas.
2. npm run test:lab02 - testa o contrato com transporte simulado.
3. npm run lab02:sondar -- parafusadeira - tenta somente uma requisicao real, mas permanece bloqueado enquanto faltarem liberacao, documentacao oficial, direitos de uso e credenciais.
4. O parametro LAB02_EXECUCAO_UNICA=sim deve ser ajustado apenas no dia da prova manual, apos verificacao efetiva das autorizacoes.

Configuracao futura em arquivo local privado .env.lab02 (nunca no chat ou GitHub): confirmar habilitacao oficial da API Shopee, confrontar a autenticacao/query com a documentacao dentro da conta, conferir permissoes de uso e entao inserir App ID e Secret. Marcadores de "sim" sao declaracoes revisadas pelo operador e nao substituem comprovacao dada pela plataforma.

## Evidencias e criterio de sucesso

Prova real e bem-sucedida significa um POST autorizado em endpoint oficialmente confirmado, retornando produtos reais e identificaveis, sem erros e respeitando os termos. Medir quantidade, cobertura, latencia, disponibilidade dos campos e possiveis limites. Com esses dados, desenhar o agendador com controle de quota, retencao e classificacao. Nao se deve ativar o agendador antes da primeira prova real.

**Status: LAB-02 IMPLEMENTADO PARA HOMOLOGACAO, FONTE REAL AINDA NAO ACESSIVEL.**
