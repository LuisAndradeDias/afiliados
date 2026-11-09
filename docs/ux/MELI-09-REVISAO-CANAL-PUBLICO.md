# MELI-09 — Revisão assistida, frescor e destino permitido (09/11/2026)

## Escopo e evidências reais
- Acer conectado; a Central na porta 3030 estava parada após encerramento em 06/11. Foi reaberta pelo inicializador existente em 09/11, sem ligar monitores; status confirmou `modoBusca=media`, `monitorAlternadoAtivo=false`, `mercadoLivreMonitorAtivo=false`, nenhum pacote preparado, envio pendente ou tarefa ativa, desconto de 20%, cooldown de 24h e prévia de 120min.
- Antes da alteração, `GET /api/mercadolivre/rascunhos-assistidos` retornava lista vazia. Não há evidência de oferta real homologada. A MELI-08 continua limitada pelo HTTP 403 nos detalhes de anúncios de terceiros; ampliar categorias não elimina essa restrição.
- Falha observável: rascunhos assistidos (quando existentes) só apareciam em Configurações → Ferramentas; a Revisão Técnica ignorava o arquivo de rascunhos. O fluxo automático para WhatsApp não verificava se o canal MELI é público e cadastrado.
- Nenhuma solicitação foi enviada ao Mercado Livre, nenhuma nova permissão/token foi criada; nenhum WhatsApp real ou negócio foi enviado durante os testes.

## Pesquisa oficial de regras de afiliados
- Página específica do Mercado Livre: **WhatsApp/Telegram somente em canais públicos e abertos; não é permitido compartilhar links em grupos fechados**, e somente canais válidos informados no cadastro. https://www.mercadolivre.com.br/l/afiliados-compartilhamento-de-publicacao
- Página de compartilhamento: grupos, canais e comunidades WhatsApp/Telegram **públicos**, sem grupos privados. https://www.mercadolivre.com.br/l/afiliados-onde-compartilhar-links
- Checklist oficial: listas de canais permitidos, vedação de grupos privados; risco de perda de ganhos. https://www.mercadolivre.com.br/l/checklist
- Descoberta de produtos: Central de Afiliados e Criadores, Tendências, Mais vendidos, Ofertas do Dia; links do **produto individual** gerados pela Central/Barra oficial. https://www.mercadolivre.com.br/l/escolha-produtos-para-recomendar e https://www.mercadolivre.com.br/l/afiliados-primeiros-passos
- Alguns materiais de marketing de versões distintas trazem textos mais gerais sobre WhatsApp; foi adotada a regra **mais específica e conservadora** sobre grupos públicos e cadastro.

## Implementação
1. Revisão Técnica `/revisao` integra `data/mercadolivre-rascunhos-assistidos.json` via GET, estritamente read-only, com `origem=rascunho-assistido-meli`, **sem somar rascunhos às ofertas observadas pelo motor**.
2. Indicadores: rascunhos assistidos e rascunhos para reconferir; filtro separado. Quando a conferência manual tem >= 120 minutos, data futura ou data inválida, marcar como reconferir preço, estoque, vendedor e link. Este marcador não é aprovação e não prova estoque.
3. Rejeição fail-closed de arquivos inconsistentes, URLs inseguras, dados adulterados e divergências de preço/desconto. Sem `podePublicar` e sem ligação com fila automática.
4. Destino MELI WhatsApp: exige declaração **manual explícita** de canal público aberto, cadastrado e ciência da proibição de grupos privados; não é verificação independente da plataforma.
5. Declaração local em `data/mercadolivre-canal-publico.json` com hash SHA-256 do nome do grupo (não armazena o nome puro), timestamp e prazo de 30 dias; inválida quando o grupo muda, em arquivo ausente/corrompido, prazo expirado ou data futura. Revogação imediata.
6. GET/POST `/api/mercadolivre/canal` só em host local e gravação com Origin local correspondente; JSON pequeno e validado, escrita atômica. A UI em Ferramentas permite confirmar/revogar, sem ativar o monitor ou autoenvio.
7. Guardas no `server.ts` (preparar ML, abrir WhatsApp, sinalizar Enviar) e nos executáveis `mercadolivre-whatsapp.ts` e `whatsapp-preparar.ts`. Sem declaração, **MELI falha fechado antes de imagem, pacote ou clique**. Amazon/Shopee preservados.
8. Configuração padrão: **não confirmada**, sem alterar a configuração existente de WhatsApp ou env. A ferramenta de rascunhos continua sem publicação ou envio.

## Critérios de teste e implantação
- TDD: `tests/meli09-revisao-assistida.mts` falhou corretamente antes da integração; `tests/meli09-revisao-visual.mts` falhou pela falta de indicadores; após implementação passaram.
- `tests/meli09-canal.mts`, `tests/meli09-canal-http.mts`, `tests/meli09-canal-visual.mts` e `tests/meli09-cli-bloqueio.mts`: bloqueio inicial, confirmação/revogação, host/origin, dados não expostos, data vencida, grupo alterado, WhatsApp não aberto. Capturas sintéticas em 1595 e 390 px.
- Executar `npm run typecheck`, `npm run test:meli09` e demais regressões; conferir GitHub Actions antes de produção.
- Deploy só após CI verde, backup/hash e monitor parado; instalar somente os arquivos necessários, sem tocar `.env`, tokens, contatos, sessão WhatsApp ou dados de ofertas reais. Auditar GET nas quatro rotas e revisar screenshots reais após o deploy.
- **Não marcar a confirmação do canal automaticamente.** O usuário deve confirmar somente se o destino específico for público e cadastrado.

## Pendências que não devem ser mascaradas
- Ainda não foi homologada uma oferta real do portal com preço, disponibilidade, reputação e link afiliado individual. Isso demanda a seleção no perfil autenticado e a conferência humana, sem tentar acessar endpoints de terceiros por rotas bloqueadas.
- Determinar se o grupo WhatsApp atualmente configurado é efetivamente público e cadastrado; até lá o WhatsApp MELI permanece bloqueado por padrão. O motor Amazon/Shopee não fica bloqueado por isso.
- Consultar o suporte do Mercado Livre sobre API autorizada para aferir dados de anúncios de terceiros para afiliados.
- Só implementar a promoção de rascunhos para uma fila autorizada depois da prova real do canal e de dados comerciais atualizados; não reaproveitar rascunho como confirmação automática.
