# Etapa 57 — Plano de evidências para divulgação no WhatsApp

Data de pesquisa: 03/11/2026. Canal: grupo já configurado na Central, sem reproduzir convites, membros ou dados pessoais.

## Estado observado, não homologado

- Teste técnico: WhatsApp Web autenticado, busca e cabeçalho do grupo confirmados, diagnostico com codigo zero.
- Arquivo local `data/elegibilidade-canais.json`: AUSENTE na instalação examinada.
- Grupo declarado no programa, modalidade pública, autorização do responsável, opt-in dos participantes: SEM EVIDÊNCIA DOCUMENTADA, não presumir.
- `WHATSAPP_AUTO_SEND_ENABLED`: false, monitor desligado.
- Nenhuma comissão, elegibilidade comercial ou autorização de automação foi confirmada neste levantamento.

## Regras oficiais consultadas (orientações divergentes)

Mercado Livre:
- https://www.mercadolivre.com.br/l/checklist — admite WhatsApp/Telegram públicos e veda grupos privados.
- https://www.mercadolivre.com.br/l/afiliados-compartilhamento-de-publicacao — permite canais públicos/abertos cadastrados, não grupos fechados.
- https://www.mercadolivre.com.br/l/afiliados-pode-compartilhar — lista WhatsApp e Telegram entre plataformas **não permitidas**.
- https://www.mercadolivre.com.br/l/boas-praticas-links — veda links em grupos privados e exige sinalização clara de publicidade.

Essas fontes públicas não resolvem o caso individual. **Não marcar `regraOficial.conflitoEsclarecido=true`** sem confirmação das regras aplicáveis à conta específica e sua modalidade.

WhatsApp:
- https://faq.whatsapp.com/5957850900902049/?category=5245250&locale=pt_BR — proíbe uso não autorizado de mensagens automáticas/em massa.
- https://www.whatsapp.com/legal/messaging-guidelines?lang=pt — diretrizes aplicadas a grupos; combate spam e automação abusiva.
- https://www.whatsapp.com/legal/WhatsApp-Terms-for-WhatsApp-Business-App?lang=pt_BR — termos de uso do app empresarial e limitações.

Mesmo que um programa de afiliados permita divulgação de links, isso **não** concede automaticamente permissão da plataforma WhatsApp para envios automatizados via navegador.

## Evidências a obter — cada marketplace independentemente

1. Regra oficial específica para o programa e a conta de afiliado, com data e endereço HTTPS.
2. Modalidade exata do destino: grupo público/aberto, canal ou grupo privado. Registrar o que foi efetivamente comprovado; grupos privados não podem ser homologados para regras que exijam publicidade em espaços públicos.
3. Autorização do administrador ou responsável pelo destino; consentimento dos participantes para receber promoções e possibilidade de parar de recebê-las.
4. Confirmação de que o canal foi informado/aceito pelo programa de afiliados, quando exigido.
5. Revisão formal por pessoa responsável, incluindo conflitos das fontes, prazo e escopo de aprovação.
6. Para **autoenvio**, comprovação separada de que o método de automação é autorizado pelo WhatsApp; caso contrário, manter revisão/publicação manual ou usar integração oficialmente permitida.

## Situação por plataforma no grupo

| Plataforma | Decisão | Ponto pendente |
|---|---|---|
| Amazon | Pendente | Confirmar termos brasileiros aplicáveis à conta, grupo e método de divulgação. |
| Mercado Livre | Pendente | Resolver divergências oficiais sobre WhatsApp e grupo público na conta. |
| Shopee | Pendente | Conta/programa ainda em preparação; confirmar divulgação permitida antes de habilitar. |
| WhatsApp (autoenvio) | Não autorizado por evidência | Confirmar permissão do método; sessão salva ou botão de enviar não constituem autorização. |

## Medidas técnicas

- `src/canais/elegibilidade.ts` mantém validação falha-fechada e não lê dados deste documento como autorização.
- `/api/status` passa a expor `elegibilidadePorPlataforma` para que a UI mostre os três estados separados, independentemente de haver oferta preparada.
- Configurações > Publicação exibe apenas diagnóstico e links de consulta. Nenhum botão concede homologação e o código de envio não foi relaxado.
- Depois de comprovadas as condições, o próximo passo será revisitar autorização comercial, documentar e realizar teste supervisionado em destino permitido, sem disparos em massa.

**Nunca inventar `data/elegibilidade-canais.json` ou marcar `homologado` para desbloquear robô.**
