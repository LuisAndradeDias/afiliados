# Home principal de métricas — acesso local sem login

Data: 29/10/2026. Projeto: Caça Promos VIP 2.0. Mudança pequena e exclusivamente de navegação/apresentação.

## Objetivo
A abertura da Central pelo endereço raiz (GET /) deve mostrar a visão geral de métricas, sem exigir login, sem exibir formulário de entrada e sem enviar mensagens. A Central de Ofertas continua disponível em GET /ofertas. A versão hospedada no Lovable é apenas protótipo e não deve expor o banco ou as APIs privadas para eliminar login.

## Implementação no Acer
- src/painel/rotas-visuais.ts: GET / responde o mesmo HTML da Central em GET /central; /ofertas continua retornando o painel de ofertas; as outras rotas não mudam.
- src/painel/public/central.html: atualiza o título para "Painel de métricas", posiciona métricas reais antes de acessos rápidos e acrescenta contadores de candidatos, bloqueados e pendentes.
- src/painel/public/central.js: preserva os quatro indicadores existentes de /api/status e lê três contadores de /api/revisao em modo somente leitura; se a API falhar, informa "—" (nunca inventa zeros). Nenhum POST ou função operacional nova.
- .github/workflows/homologacao-etapa50.yml: dois testes de home sem login e responsividade.

## Origem dos números
- /api/status: motor, fluxo, próxima fonte e oferta preparada.
- /api/revisao: candidatas, bloqueadas e que precisam de revisão; esses valores se referem aos registros locais, não são vendas, lucro ou comissões.
- Dados privados de contatos não são consultados na nova home.

## Prototipagem Lovable (projeto independente)
- Projeto: Afiliado AI Central (protótipo Lovable, React + Supabase).
- Rota pública / com painel de métricas sem login nem botão Entrar; sem autenticação não há fonte pública autorizada dos indicadores, por isso apresenta "—".
- Rotas privadas da aplicação Lovable continuam protegidas. Não foi removida a segurança de banco, contas ou permissões.
- A Central de produção do Acer usa dados próprios e não depende do Lovable.

## Homologação
- testes/home-metricas.mts: GET / === /central, métricas acima de acessos rápidos, sem login, /ofertas intacto.
- tests/home-metricas-visual.mts: navegação com dados de API simulados, desktop e celular, sem transbordamento horizontal e sem login.
- TypeScript, regressões e GitHub Actions antes de implantá-la.
- Para implantação: backup SHA-256, copiar somente arquivos alterados, reiniciar apenas Central 3030, confirmar /, /ofertas, /revisao e /api/status, monitores e autoenvio desligados, Captação 3040 inalterada.

## Não fazer
- Não remover autenticação de Supabase ou expor dados privados ao público.
- Não ativar postagem, monitores, convites, campanhas ou início automático.
- Não instalar dependências novas, duplicar servidores, reconfigurar Chrome/Conector 02 ou alterar grupo WhatsApp.
