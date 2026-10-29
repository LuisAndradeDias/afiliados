# Etapa 58 — Central de revisão e evidências, incremento 1

Data: 29/10/2026. Branch: feat/etapa50-homologacao-segura.
Estado: consulta e interface somente leitura; não constitui homologação comercial.

## Entregas

1. GET /revisao: nova interface minimalista, filtrável, com fichas de evidências, situações e motivos de bloqueio.
2. GET /api/revisao: entrega um panorama sanitizado, sem URL de rastreio, códigos de cupom, tokens, cookies, mensagens, contatos ou dados de sessão.
3. src/revisao/consulta.ts: normaliza as duas fontes operacionais existentes em C:\projeto02\data:
   - ultima-oferta-whatsapp.json
   - ultima-oferta-mercadolivre.json
4. A ficha mostra origem do registro, marketplace, identificadores, preço observado em BRL quando válido, atualização do arquivo, evidências e motivos estruturados.
5. Evidências: identificação, preço, disponibilidade, cupom, formato de link, atribuição e elegibilidade do canal. Nenhum arquivo substitui validação ao vivo.
6. Preço contextual e estoque registrados expiram em 10 minutos. Falta de seller/annuncio ou preço divergente não comprova disponibilidade.
7. Duplicatas idênticas não são somadas; divergências de preço ou vendedor bloqueiam ambas as observações.
8. Erros de JSON, arquivos ausentes e registros incompletos não causam publicação ou dados fictícios. Limite de leitura: 128 KiB por arquivo.
9. A decisão nunca recebe podePublicar=true a partir de um snapshot. O contador de aprovadas é 0 por construção nesta primeira versão.
10. Interfaces /central e /ofertas oferecem navegação para /revisao; não são adicionados controles de aprovação/envio.

## O que estes dados NÃO comprovam

- Disponibilidade atual ao comprador.
- Aplicação de cupom naquele checkout.
- Vendedor vencedor vigente na página.
- Validade do link e redirecionamento final.
- Atribuição ou pagamento de comissão.
- Autorização do WhatsApp ou do canal sem homologação formal.

## Segurança e privacidade

- API local read-only, sem endpoint de gravação e sem operações externas.
- A interface usa textContent, não injeta títulos de produtos como HTML.
- CSP restritiva na rota visual; conteúdo e API com no-store.
- Sem dados de contatos, cookies, tokens, URLs de afiliado ou códigos de cupom na resposta.
- Não instala serviços, não ativa monitores nem altera o grupo existente.
- Não duplica bancos de dados: reusa apenas arquivos já existentes.

## Testes e critérios

- tests/etapa58-revisao.mts: 10 cenários com fixtures isoladas; ausência de dados, canal pendente, preço, vendedor, estoque, cupom, links, deduplicação, divergência, tamanho/JSON e leitura sem mutação.
- tests/etapa58-revisao-visual.mts: navegador Chrome headless isolado, filtros, métricas, escape HTML, cabeçalhos de segurança e leitura apenas por GET.
- npm run typecheck.
- Regressões de domínio, WhatsApp, preços, cupons, extensão e Central.
- CI GitHub Actions: homologacao-etapa50.yml.

## Próximas entregas da Etapa 58

1. Modelar Candidate, Evidence e OfferDecision como histórico persistente, versionado e auditável, incluindo origem e validade por campo.
2. Criar fila de candidatos real, deduplicada e separada de pacotes preparados e de mensagens efetivamente enviadas.
3. Ações supervisionadas: descartar, solicitar revalidação, bloquear e registrar decisões humanas, sem falsificar evidências ou disparar envio.
4. Adaptar conectores de Amazon/Mercado Livre/Shopee ao mesmo modelo de proveniência; Shopee só com autorização oficial.
5. Homologar regra do canal real de maneira formal; até lá, envios permanecem bloqueados.

## Controle de implantação

Implantar apenas após CI e testes locais. Fazer cópia SHA-256 antes de substituir arquivos; não reiniciar Captação, Chrome, Conector 02 ou acionar WhatsApp. O serviço deve continuar pausado depois do reinício controlado.
