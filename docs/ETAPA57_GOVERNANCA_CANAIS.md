# Etapa 57 — Governança de canais e elegibilidade comercial (incremento 1)

Data: 29/10/2026. Branch: feat/etapa50-homologacao-segura.

**Escopo:** classificação de grupos WhatsApp antes de preparar/enviar ofertas Amazon, Mercado Livre ou Shopee. Falha segura por padrão. Não ativa monitores, não cria publicações, não modifica grupos, não exige novo nome do grupo, não muda credenciais e não homologa comissão.

## Por que este controle é necessário

A documentação oficial do Mercado Livre exibe regras divergentes:
- https://www.mercadolivre.com.br/l/checklist — canais WhatsApp/Telegram públicos, não grupos privados.
- https://www.mercadolivre.com.br/l/afiliados-compartilhamento-de-publicacao — somente canais públicos/abertos e cadastrados.
- https://www.mercadolivre.com.br/l/boas-praticas-links — evita grupos privados/chats fechados e exige sinalizar publicidade.
- https://www.mercadolivre.com.br/l/afiliados-pode-compartilhar — página que lista WhatsApp e Telegram como não permitidos.

Essas páginas não comprovam automaticamente as condições aceitas pela conta específica. A divergência exige revisão dos termos aplicáveis e, quando necessário, confirmação oficial. A geração de link não demonstra direito à comissão. Regras de automação do WhatsApp também se aplicam.

## Implementação entregue na branch

- src/canais/elegibilidade.ts: motor tipado com estados elegivel, pendente-verificacao, nao-elegivel, suspenso, necessita-revisao; retorna código, motivo e decisão.
- src/robo/whatsapp-preparar.ts: recusa canal não homologado antes de abrir Chrome ou consultar preço; repete verificação antes do clique automatizado/pelo painel. Código 8, sem apagar oferta.
- src/painel/server.ts: status expõe diagnóstico sanitizado; ação de envio também valida o canal antes de criar sinal; bloqueio não é contado como publicação e pausa monitor quando necessário.
- src/painel/public/index.html: informa canal não homologado e motivo sem obrigar redigitar o destino.
- tests/etapa57-canais.mts: estados, domínios, validade, duplicatas, marketplaces e bloqueio real do preparador num diretório isolado.
- .github/workflows/homologacao-etapa50.yml: testes específicos no CI.

## Registro de elegibilidade

Arquivo local não versionado: data/elegibilidade-canais.json (relativo à instalação executada; data/ consta no .gitignore).

**Nenhuma homologação foi criada para o grupo real.** Ausência do arquivo/registro bloqueia o envio. Configuração malformada, conflitante ou antiga também bloqueia.

Modelo ilustrativo NÃO aprovado:

~~~json
{
  "versao": 1,
  "registros": [{
    "destino": "GRUPO FICTICIO - NAO USAR",
    "plataforma": "mercado-livre",
    "tipo": "whatsapp-grupo",
    "visibilidade": "desconhecido",
    "autorizadoPeloResponsavel": false,
    "declaradoNoPrograma": false,
    "homologacao": {
      "estado": "pendente",
      "responsavel": "",
      "aprovadaEm": ""
    },
    "regraOficial": {
      "url": "https://www.mercadolivre.com.br/l/checklist",
      "verificadaEm": "",
      "permiteDivulgacao": null,
      "conflitoEsclarecido": false
    }
  }]
}
~~~

O destino deverá coincidir exatamente com o grupo já salvo, caso venha a ser aprovado. Cada marketplace precisa de revisão independente. Aprovação exige: grupo público, autorização do destino, declaração no programa, regra aplicável sem divergências, URL HTTPS de domínio oficial, verificação e homologação nos últimos 30 dias e revisor responsável. Um arquivo local não constitui prova de comissão nem substitui confirmação oficial.

## Limites e próximas tarefas

1. Obter regra aplicável à conta e verificar se grupo atual é público e permitido. Na dúvida, manter bloqueado.
2. Completar inventário de canais e modalidades (WhatsApp canal, Telegram, vitrine pública), sem relaxar segurança.
3. Evoluir interface, trilha de auditoria, versionamento de regras e revisão de evidências (Etapa 58).
4. Homologar separadamente Amazon/Shopee sob seus próprios termos brasileiros.
5. Após preparo autorizado, o WhatsApp ainda permite clique direto do usuário; as barreiras de envio cobrem o robô e o painel, não o aplicativo de terceiros após uso manual.

Não criar homologação fictícia em produção, ativar envios automáticos, instalar autostart ou mesclar o PR antes dos requisitos comerciais.
