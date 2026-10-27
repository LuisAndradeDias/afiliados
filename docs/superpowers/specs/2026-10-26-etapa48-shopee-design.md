# Etapa 4.8 — Shopee no painel Afiliados 2.0

**Data:** 2026-10-26. **Base:** PR #45, branch `fix/mercadolivre-descoberta-etapa47`. **Decisão do proprietário:** a Shopee fará parte da Central Unificada com Amazon e Mercado Livre e usará futuramente o mesmo grupo WhatsApp já configurado. **Conta Shopee ainda não criada.**

## Design aprovado pelo proprietário

Abordagens consideradas: (1) painel Shopee isolado e WhatsApp próprio — rejeitado pelo proprietário; (2) adicionar apenas cards decorativos sem função — insuficiente para "deixar tudo no esquema"; (3) **selecionada: terceira área da Central + cadastro de links de afiliado manual + rascunhos persistidos localmente**, sem habilitar robôs ou criar credenciais imaginárias. Quando a Shopee liberar a conta/Open API, ampliar através de integração oficial sem duplicar filas/sessões.

## A experiência

- A página `/central` mostra Shopee como terceira plataforma e link para `/shopee`. A página `/ofertas` também oferece navegação para Shopee e atualiza o título geral.
- `/shopee` segue os mesmos tokens/design minimalistas da Central: sidebar, topo, hero, status "Aguardando sua conta", etapas de configuração, bloco para link manual com título, URL e preço opcional, rascunhos salvos, instruções de comissão/link, e estado da Open API bloqueado.
- O usuário **precisa gerar o link no portal de Afiliados Shopee** e confirmar que o link já contém sua identificação; nenhum URL comum é anunciado como monetizado nem a aplicação finge conversão.
- Os rascunhos não podem ser enviados, não são misturados ao histórico de promoções publicadas, não abrem Chrome/WhatsApp e não começam campanhas. Somente salvar/listar/excluir mediante ações do usuário; copiar link é exclusivamente local no navegador.
- Todo o sistema existente de envios, opt-in e grupo mantém-se **intocado**; integração do fluxo Shopee nessa fila virá na fase API quando aprovada, sem criar grupo novo.

## API e dados

- Persistir JSON local em `data/shopee-rascunhos.json` da instalação de execução, com gravação atômica, IDs aleatórios, limite 100, título limpo (3..120), link HTTPS válido com hostname de confiança (somente `shopee.com.br`, subdomínios `*.shopee.com.br`, `shope.ee`, `s.shopee.com.br`), preço opcional validado, e confirmação explícita do usuário sobre link afiliado. **Nenhuma chave ou conta Shopee é armazenada** nesta fase.
- API REST local: `GET /api/shopee/status`, `GET /api/shopee/rascunhos`, `POST /api/shopee/rascunhos` e `DELETE /api/shopee/rascunhos/:id`. POST/DELETE só na interface local com Origin compatível, negar Sec-Fetch-Site cross-site, Content-Type JSON, tamanho <= 12KB e mensagens genéricas sem interpolar links maliciosos.
- Endpoints só no servidor Node local loopback. Não usar CORS permissivo, banco de dados, PostgreSQL, rede externa de API, Google Drive, anúncios fictícios, bypass dos filtros.
- Status da API Shopee: `aguardando_credenciais`, `automacaoDisponivel: false`. UI não terá campos de senha ativos até conta e requisitos oficiais serem confirmados. Não inventar ganhos/comissões.

## Testes e rollout

- TDD: testes de links legítimos, domínios impostores, HTTP, credential no URL, preço, tamanho, ID, duplicidade; persistência/reload/corrupção, exclusão, segurança POST cross-site; status; verificação de links da UI e controles existentes.
- CI Windows e Linux, typecheck, audit, testes de monitor/Meli/Amazon, consentimento.
- PR draft #46 sobre #45, sem merge. A instalação ACER em `C:\afiliados-v2-homologacao` não deve receber conteúdo sem backup, prova de que tarefas de envio não estão ativas e confirmação de paths de diff. Nada de envios.
- Se for seguro, instalar apenas arquivos Shopee/nav/route com backup protegido e restart controlado 3030, sem alterar Captação 3040 e sem ativar monitor. Preservar `C:\projeto01` e todos os backups.
- O portal oficial da Shopee permite criação manual de links pelo computador e app; API e acesso oficial dependem da conta aprovada. Refs na documentação operacional do PR, nunca cópia de tokens.
