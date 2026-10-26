# Afiliados 2.0 — Etapa 4.2: separação gradual de domínios

**Data:** 2026-10-26. **Base:** PR #39 (`refactor/modulos-http-v2`). **Escopo aprovado:** continuar a Etapa 4.2 em branch isolada, sem deploy no Windows.

## Intenção e resultado

Preparar o sistema para evolução segura separando regras reutilizáveis de Amazon, Mercado Livre e scripts de WhatsApp, e separando **consultas locais de contatos/campanhas** do roteador HTTP monolítico da Captação. A mudança deve manter *idênticos* os endpoints, retornos, status HTTP, autenticação, consentimento e estados operacionais.

## Requisitos e limites

- Não publicar/mesclar automaticamente, não sincronizar para `C:\projeto01`, não ler/alterar `.env`, `data/`, `dados/`, perfis Chrome ou contatos.
- Não executar OAuth real, envio WhatsApp, WhatyGo, extensão ou rotinas de promoções em testes. Dados de teste são fictícios e temporários.
- Não instalar PostgreSQL, Cloud API, nem criar proxy de contatos entre portas.
- `acessoCampanhasLocais` permanece **dentro do servidor** e precede qualquer consulta extraída; checagens de `Host`, `Origin`, `sec-fetch-site`, loopback, `x-cpv-local` intactas.
- Estado mutável, timers e decisões de envio de `server.ts` e `server.mjs` continuam nos servidores. Em especial, o estado aleatório OAuth deve ser gerado no mesmo momento lógico de antes.
- API local de campanhas preserva GET **e HEAD** nas rotas hoje permitidas. Respostas e conteúdo dos erros devem ser equivalentes.
- No Mercado Livre, URL de autorização é HTTPS com callback no caminho fixo atual; requisição de troca de código mantém `application/x-www-form-urlencoded`, endpoint e mensagens de erro. Sem imprimir tokens reais.
- No WhatsApp, somente a lista estática de scripts permitidos é extraída; **não** mover o lançamento dos processos, a preparação ou o envio.

## Abordagens

1. Reescrever os dois backends em um gateway único: alto risco para perfis Chrome e acesso a contatos; não fazer.
2. Separar *bounded contexts* com interfaces pequenas e injeção de dependências, mantendo os routers atuais como fronteira de segurança (**escolhida como continuação incremental da Etapa 4.1**).
3. Apenas mover grandes blocos de texto sem testes: menor esforço inicial, maior risco de regressão; rejeitada.

## Limites implementáveis neste PR

- Domínio Ofertas: `src/painel/dominios/amazon-tag.ts`, `mercadolivre-oauth.ts` (helpers/validação HTTP com `fetch` injetável), `scripts-robo.ts` (allowlist WhatsApp/Amazon/Meli).
- Domínio Captação: `src/consultas/gestao.mjs` para GET/HEAD de contatos/resumo/denúncias; `src/consultas/campanhas.mjs` para GET/HEAD de filas, configurações e estados já disponibilizados localmente. Ambos retornam um objeto de resposta ou `null` e **não** fazem autenticação.
- `src/painel/server.ts` e `captacao/caca-promos-vip/src/server.mjs` usam os módulos sem alterar endpoints.
- Testes RED→GREEN para as interfaces novas, regressão de contratos (Host inválido, POST bloqueado, permissões, status 404), suites antigas e Chrome headless somente para telas.
- Nova workflow da branch; PR draft dependente de #39.

## Fora do escopo

- Dividir fisicamente a camada executora (fila de envio e processos Chrome), pois requer contrato de concorrência, observadores e validação Windows.
- Substituir a interface visual, alterar modelos de campanha e grupo padrão, trocar bancos de dados ou construir envio automático novo.
- Corrigir bugs operacionais históricos de Meli/WhatsApp sem testes reproduzindo-os.

## Critérios de aceitação

- TypeScript sem erros; testes de helpers Amazon/Meli/scripts e consultas locais passando.
- Não há caminho para requisição pública acessar consultas de contatos por métodos/Host/Origin incorretos; as mesmas verificações de acesso precedem o roteamento.
- Requests existentes de status e histórico usados pela interface e campanhas continuam retornando contrato/erros idênticos.
- CI rodando somente dados de exemplo sem credenciais, com documentação de rollback.
