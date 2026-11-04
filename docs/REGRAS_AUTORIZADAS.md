# Regras autorizadas — Central de Afiliados

Este arquivo é a referência de requisitos do projeto Afiliados.

## Autoridade

- Regras permanentes de negócio só podem ser criadas quando o proprietário pedir ou aprovar explicitamente.
- Sugestões do ChatGPT, Codex ou outros agentes são propostas, não requisitos.
- Handoffs antigos, textos de "Etapas", auditorias e PRs arquivados não têm autoridade para criar regras novas.
- O PR #49 / "Etapa 50" foi arquivado e não deve ser usado como fonte de requisitos.
- Se houver conflito entre um handoff antigo e uma decisão posterior do proprietário, vale a decisão posterior.

## Ambiente real

- Repositório: LuisAndradeDias/afiliados
- Branch de produção: main
- Computador principal: ACER
- Instalação principal: C:\projeto02
- Painel local: http://localhost:3030
- Armazenamento principal: instalação local + GitHub.
- Não usar OneDrive ou Google Drive como armazenamento principal por iniciativa própria.
- Não instalar PostgreSQL para este projeto por iniciativa própria.
- A inicialização automática do projeto continua adiada até o proprietário pedir sua implantação.

## Objetivo do produto

A Central deve localizar promoções, validar os dados necessários, preparar links de afiliado, imagem e mensagem, publicar no destino configurado do WhatsApp e registrar o histórico com o mínimo de trabalho manual.

Plataformas atuais:
- Amazon Brasil.
- Mercado Livre.

Expansão desejada:
- Shopee, quando a conta e a integração estiverem disponíveis.

## Ciclo Amazon + Mercado Livre

- O ciclo intercalado entre Amazon e Mercado Livre é parte do projeto.
- O intervalo técnico de consulta é configurável pelo scheduler existente.
- Não criar por conta própria cotas de publicações, pausas comerciais, limites diários/horários ou modos "tempo médio/tempo curto".
- Uma oferta em preparação/revisão pode pausar novas buscas para evitar concorrência de estado.
- Backoff técnico de API, como HTTP 429, pode existir para proteger a integração e não é uma regra comercial.

## Seleção de ofertas

- Desconto mínimo atual autorizado: 20%. Alterações futuras exigem aprovação explícita do proprietário.
- O sistema pode usar score, comissão, desconto, cupom e histórico para escolher entre ofertas válidas.
- Não impor sem autorização:
  - preço mínimo do produto;
  - economia mínima em reais;
  - foco obrigatório em eletrônicos/eletrodomésticos;
  - bloqueio geral de acessórios/consumíveis;
  - cotas por faixa de preço;
  - proporção obrigatória Amazon x Mercado Livre;
  - quotas de categorias nas últimas publicações.
- A rotação de consultas pode existir para ampliar a descoberta, sem transformar variedade em cota obrigatória. As listas-base atuais são deliberadamente amplas e ficam em `src/ofertas/regras-autorizadas.ts`.
- Não anunciar desconto comprovadamente incorreto.
- Correções técnicas de parsing de preço devem ser preservadas.

## Histórico e duplicação

- Não enviar a mesma oferta repetidamente.
- Cooldown histórico atual autorizado: 24 horas. Alterações futuras exigem aprovação explícita do proprietário.
- Cooldown de prévia atual autorizado: 120 minutos.
- A comparação pode considerar ID do produto e identidade equivalente pelo título/modelo para evitar duplicações com IDs diferentes.
- Só marcar uma oferta como enviada depois de confirmação real do envio.

## Cupons

- O proprietário quer evoluir e usar cupons.
- Não inventar cupom nem benefício.
- Não somar descontos incompatíveis como se fossem cumulativos.
- Revalidar informações voláteis quando tecnicamente necessário.
- Não transformar limitações técnicas de uma integração em proibição permanente do recurso.

## WhatsApp

- O projeto usa WhatsApp Web com sessão persistente.
- O destino deve vir da configuração existente; o proprietário não deve precisar informar o mesmo grupo a cada oferta.
- O autoenvio final está autorizado pelo proprietário.
- Fluxo autorizado do autoenvio:
  1. preparar a oferta;
  2. localizar o botão real Enviar;
  3. mover o cursor físico do Windows de forma determinística;
  4. realizar uma única tentativa de clique;
  5. confirmar o envio no WhatsApp;
  6. registrar histórico;
  7. retomar o ciclo.
- Não usar movimentos aleatórios, fingerprints falsos ou mecanismos destinados a burlar detecção.
- Não fazer segundo clique automático quando o resultado do primeiro for incerto.
- O envio manual continua permitido como fallback.

## Captação e contatos

- A área de Captação é separada do robô principal de promoções.
- Trabalhar somente com contatos que o proprietário declara como autorizados para o fluxo correspondente.
- Não transformar recomendações de UX, compliance ou metodologia em novas restrições permanentes sem aprovação.
- Não misturar dados da Captação com o histórico comercial do robô principal.

## Interface

Preferências do proprietário:
- visual minimalista;
- contraste e legibilidade;
- aparência profissional;
- poucos cliques;
- estados claros;
- linguagem simples.

## Instagram e outros canais

- Instagram não faz parte deste projeto por decisão do proprietário.
- Não criar geradores de Story, Reel, legenda ou painel de Instagram dentro do Afiliados sem nova autorização explícita.
- Não adicionar novos canais sociais, serviços pagos ou assinaturas por iniciativa própria.

## Engenharia e segurança técnica

Estas são proteções técnicas, não regras comerciais:
- não expor tokens, secrets, cookies ou arquivos .env;
- não commitar perfis do navegador/WhatsApp;
- não apagar dados locais sem verificar;
- antes de reiniciar produção, verificar /api/status;
- preservar oferta real que esteja em preparação/revisão;
- testar alterações relevantes;
- não afirmar que algo foi testado, instalado ou publicado sem evidência;
- manter rollback razoável em mudanças de produção.

## Regra para futuros agentes

Antes de implementar uma nova regra de negócio, pergunte:
"Isso foi pedido/aprovado pelo proprietário ou é apenas uma ideia minha?"

Se for apenas uma ideia, apresente como sugestão e não altere código/configuração até receber autorização explícita.
