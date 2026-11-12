# LAB-01 — Descoberta de promoções (replay offline, 12/11/2026)

## Missão e limites

Testar se o Caça Promos VIP consegue **descobrir candidatos**, construir histórico, separar produtos parecidos, encontrar quedas e recusar falsos descontos ou cupons sem validação.

**Não houve busca de produtos em Amazon, Shopee ou Mercado Livre.** Tudo é um replay local com produtos e preços inventados. O laboratório demonstra a lógica que receberia feeds de APIs autorizadas no futuro; **não demonstra uma conexão comercial funcionando**. Não realiza scraping, requests externos, autenticação, escrita em banco operacional, WhatsApp ou postagem.

O Mercado Livre informou no protocolo 494444122 que o Programa de Afiliados não disponibiliza API de busca de produtos. O canal MELI deste laboratório é exclusivamente curadoria assistida, nunca simulação de acesso "liberado" à API de terceiros.

## Arquitetura experimental

- \`labs/descoberta/motor.ts\`: motor puro, determinístico e sem dependências de rede.
- \`labs/descoberta/fixtures.ts\`: quatro ciclos históricos fictícios, em 02, 06, 09 e 12 de novembro, com alterações de preços de produtos, cupons e disponibilidade.
- \`labs/descoberta/executar.mts\`: gera relatório JSON e HTML local, sem publicar.
- \`labs/descoberta/painel-template.html\`: dashboard interativo offline com quatro ciclos, filtros, série histórica e diagnóstico de bloqueio.
- \`tests/lab-descoberta.mts\`: testes unitários de requisitos, idempotência, datas, identidade, retenção em memória e condições de bloqueio.
- \`tests/lab-descoberta-ui.mts\`: Chrome real desktop/tablet/celular, 0 chamadas externas, pixel do rodapé da barra lateral.
- Nenhum dos arquivos altera \`src/painel/server.ts\`, \`C:\projeto02\`, arquivos \`.env\`, monitor, fila, WhatsApp ou banco de produção.

## Regras técnicas

1. Fonte = Amazon/Shopee só em fixtures; Mercado Livre só em seleção assistida. Falhas de proveniência são rejeitadas.
2. A identidade comercial considera canal, ID, vendedor, variante e modalidade de pagamento. Produto com variante nova não herda o histórico da anterior.
3. Preço monitorado = preço do item + frete confirmado. Frete indefinido impede a comparação confiável.
4. Referência histórica = mediana das **três observações anteriores** do mesmo item, em pelo menos **três datas distintas**. O preço riscado do anúncio não serve de referência.
5. Quedas de 10% a 45%, com estoque marcado como confirmado na **fixture**, podem entrar **na fila para revisão humana**. Queda acima de 45% vai para investigação por possível erro.
6. Observações com mais de 24 horas, estoque indefinido, frete desconhecido ou histórico inadequado não ficam aptas à revisão automática.
7. Cupom informado sem validação não é aplicado. Cupom com regras simuladas gera apenas **preço final estimado**: não comprova elegibilidade, estoque ou resultado do checkout.
8. Duplicata do mesmo ID e instante é ignorada; alteração divergente no mesmo instante é rejeitada; dados inválidos são rejeitados.
9. **Todas as avaliações têm \`podePublicar=false\` e \`fonteRealAutorizada=false\`.** Nenhum estágio libera automação de mensagens.

## Resultado efetivamente medido no Acer

| Métrica | Laboratório |
|---|---:|
| Rodadas fictícias | 4 |
| Coletas de fonte simuladas | 12 |
| Observações recebidas | 44 |
| Observações aceitas | 41 |
| Duplicatas descartadas | 1 |
| Conflitos / entradas inválidas rejeitados | 2 |
| Candidatos à revisão no último ciclo | 3 |
| Bloqueadas no último ciclo | 6 |
| Em acompanhamento no último ciclo | 3 |
| Buscas em APIs reais | 0 |
| Mensagens e publicações | 0 |

Candidatos sintéticos na rodada final: air fryer Shopee (-25,0%), SSD Amazon (-20,0%) e smartphone Shopee (-13,3%). Esses percentuais foram **calculados**, não observados no comércio real.

## Evidência visual e execução local

No diretório de desenvolvimento da branch:

- \`npm run lab:descoberta\` gera \`test-results/lab-descoberta/radar-laboratorio.html\` e \`resultado.json\`.
- \`npm run test:lab-descoberta\` executa motor + geração + Chrome.
- Abrir \`radar-laboratorio.html\` no Chrome do Acer para alternar ciclos, explorar triagem e selecionar produtos.
- Capturas: \`test-results/lab-descoberta/radar-1440.png\`, \`radar-768.png\` e \`radar-390.png\`.
- Os resultados, capturas e JSON gerados são artefatos experimentais e **não devem ser confundidos com observações reais**.

## Caminho para uma fonte realmente automática

**Amazon:** A Creators API dispõe de \`SearchItems\` e \`GetItems\`, mas exige aprovação, cadastro e credenciais da conta de Associados. A licença do programa pode impor restrições específicas à agregação, histórico, reuso, envio de mensagens e publicação do conteúdo. É obrigatória a avaliação desses termos e, se necessário, aprovação prévia **por escrito** para o caso de uso antes de conectar um coletor.
- https://associados.amazon.com.br/creatorsapi/docs/en-us/introduction
- https://associados.amazon.com.br/creatorsapi/docs/en-us/onboarding/register-for-creators-api
- https://associados.amazon.com.br/help/operating/policies

**Shopee:** O portal oficial de afiliados oferece ferramentas de oferta e geração de links. Existe um caminho de Open API para contas habilitadas, mas **não verificamos acesso nem credenciais desta conta**; detalhes técnicos obtidos de guias de terceiros exigem validação no canal oficial antes de implementar.
- https://affiliate.shopee.com.br/open_api
- https://help.shopee.com.br/portal/10/article/128461-Como-gerar-links-de-produtos-ou-lojas

**Mercado Livre:** seguir apenas por curadoria voluntária/assistida e dados efetivamente verificados, de acordo com resposta recebida do suporte. Nenhum novo cliente HTTP de catálogo.

Próxima passagem recomendada: escolher UMA fonte aprovada, obter seus termos e credenciais de maneira segura, desenvolver um adaptador desacoplado que se recuse a ligar sem concessão real, testar pequeno lote com observações de verdade e manter aprovação humana no início. Só depois avaliar polling, retenção legal, dedup de produção e integração com a Central.

## Segurança operacional

Não alterar \`C:\projeto02\`, não iniciar autoenvio ou monitores, não instalar PostgreSQL, não ativar inicialização automática, não gerar links de afiliados falsos e não tratar a execução local como disponibilidade operacional de feeds.

## Orquestração de múltiplas fontes simuladas

O arquivo `labs/descoberta/orquestrador.ts` simula **12 consultas assíncronas** (3 fontes × 4 ciclos) aos adaptadores sintéticos. Nenhum endpoint real é chamado; o modo live é recusado antes de qualquer execução. Falhas de uma fonte não contaminam as demais; uma resposta de origem incorreta é descartada por inteiro. A política é verificada nos 17 testes unitários e na suíte do Chrome.

O laboratório carrega observações instantaneamente; **não executa um cron real nem monitora preços em produção**. É um ensaio dos contratos e da classificação previstos para uma futura integração autorizada.
