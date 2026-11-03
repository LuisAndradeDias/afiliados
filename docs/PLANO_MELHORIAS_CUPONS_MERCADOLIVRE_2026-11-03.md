# Etapa futura — descoberta e confirmação de cupons Mercado Livre

**Registrado em:** 03/11/2026
**Prioridade:** alta, após validar a busca de ofertas e o canal de divulgação.
**Estado:** planejado, ainda não habilitado.
**Princípio:** nenhuma promoção, preço final, comissão ou cupom será apresentado como confirmado sem evidência real e atual.

## Diagnóstico atual

- O motor já tenta ler fontes públicas oficiais e cache de cupons; a API retorna candidatos de descontos próprios mesmo sem cupom.
- Última rodada observada: zero cupons verificáveis; mecanismo de coleta repete tentativa em até 15 minutos, com cache de falha.
- src/afiliados/mercadolivre-cupons.ts contém parse, cache e ranking; src/ofertas/cupons-politica.ts exige confirmação de produto/anúncio e checkout.
- A indisponibilidade de cupons não é falha de conexão API e não deve ocultar ofertas com descontos próprios válidos.

## Próximas entregas, por ordem

1. **Inventário das fontes oficiais:** revisar página pública de promoções, selos, cupons e fontes autorizadas de afiliados; registrar URL oficial, contexto e condições de acesso. Não inventar endpoints ou credenciais.
2. **Observabilidade:** separar contadores de cupons coletados, novos, vencidos, com elegibilidade desconhecida, confirmados no item e confirmados no checkout; registrar falha de coleta sem esconder ofertas.
3. **Leitura com robustez:** tratar mudanças de formato HTML, termos de uso, cupons por categoria, compra mínima, limite de desconto, validade e elegibilidade por conta. Respeitar rate limit e intervalos de verificação.
4. **Conciliação cupom/produto:** conferir produto e anúncio vencedor, limites, cumulatividade e preço atual real; não aplicar cupons genéricos a produtos incompatíveis.
5. **Revisão supervisionada de checkout:** somente com autorização e revisão humana; salvar prova datada de preço/condições sem iniciar compra e sem expor dados de conta.
6. **UX dos cupons:** adicionar ao painel contadores e etiquetas “coletado”, “candidato”, “precisa verificar”, “confirmado para este produto” e “expirado”; nunca mostrar preço reduzido com cupom apenas estimado.
7. **Testes:** cenários de cupom expirado, conta não elegível, limite de usos, compra mínima, não cumulativo e rate-limit; teste controlado e sem compra.

## Dependências

- Confirmar API e estado da extensão Mercado Livre separadamente.
- Corrigir a cobertura de categorias e medir taxa de candidatos oficiais verificáveis antes de alterar limites.
- Manter o envio WhatsApp bloqueado até homologação comercial específica do canal e marketplace.
- A pesquisa futura pode aprofundar integração de cupons específicos de afiliados quando existirem fontes oficiais autorizadas.

**Não ativar automaticamente** captura agressiva, web scraping de acesso restrito, compra, cupons inventados ou envios para grupos não homologados.
