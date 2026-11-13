# Integração incremental — Caçador Claude × Caça Promos VIP (13/11/2026)

## Objetivo e situação
Integrar as ideias comprováveis **em código** do protótipo Flask/Python no motor
já existente em TypeScript, sem substituir a Central, os arquivos de dados ou os
mecanismos de autorização. Esta etapa é um **comparador offline** e não uma
integração operacional de descoberta/WhatsApp.

A origem foi lida no ACER em `I:\Meu Drive\robo_ofertas`. O original não foi
alterado. Uma **cópia local de código de referência** (15 arquivos, incluindo
10 Python e os recursos HTML/CSS/JS, mas sem dados de execução) está em:
`%LOCALAPPDATA%\Projeto04\trabalho-seguro\integracao-cacador-claude\fonte-claude`.
Ela **não faz parte do Git**. Não copie para GitHub `ofertas.db*`, `sessao.json`,
`config.local.json`, perfis de navegador, `.venv/`, logs e debug, cookies ou
sessões de WhatsApp.

## Funções adaptadas
- `src/ofertas/cacador-claude.ts`: porta as ideias de `banco.memoria`,
  `achadinhos.avaliar` e `achadinhos.parecido` para funções puras TypeScript.
- Memória usa períodos UTC de **6 h**, menor preço por período, mediana histórica,
  mínimo e máximo. **Nunca** mistura ID, vendedor, variante ou forma de pagamento;
  somente usa observações anteriores ao preço em avaliação.
- Vereditos: `aprendendo`, `menor_preco`, `bom_preco`, `normal`, `acima`.
- Pontuação conserva critérios de preço, desconto, avaliações, vendidos, frete,
  Full e comissão **estimada**. Cupom só pontua quando foi confirmado por
  evidência externa; o módulo **não valida** cupons ou comissões sozinho.
- `labs/descoberta/cacador-claude-adapter.ts` cruza o score com os bloqueios
  já existentes no LAB-01, que sempre prevalecem. Ausência de dados
  de nota, frete, comissão ou cupom **não vira valor inventado**.
- `labs/descoberta/executar.mts` passa a gerar
  `test-results/lab-descoberta/comparativo-cacador-claude.json`
  durante o replay fictício já existente.

## Não integrado nesta fase
O módulo novo **não é importado por** `src/painel/server.ts`, não realiza
requests ou scraping, não inicia navegador, não gera links, não mexe em filas,
não envia WhatsApp e não lê o banco operacional. Não transforma score em
permissão de publicação; o retorno `podePublicar` é sempre `false`.

Os arquivos de origem `navegador.py` e `afiliado.py` usam mecanismos de
navegação automatizada e endpoints internos do Mercado Livre. Eles **não
foram incorporados ao código operacional**: as permissões e os termos precisam
ser avaliados antes de qualquer proposta real. Não contornar HTTP 403,
CAPTCHAs, autenticação, bloqueios ou limites.

O protótipo Python também tem recuperação de envios interrompidos e uma
confirmação do WhatsApp que pode ser inconclusiva; não transportar essa lógica
sem resolver idempotência e confirmação independente.

## Testar
No checkout separado, após `npm.cmd ci --ignore-scripts`:

```powershell
npm.cmd run typecheck
npm.cmd run test:cacador-claude
npm.cmd run lab:descoberta
```

Inspecionar `test-results/lab-descoberta/comparativo-cacador-claude.json`.
Toda amostra vem de fixtures inventadas do LAB-01; o resultado não comprova
uma descoberta real nem uma oferta elegível.

## Próximas fases propostas (não executadas)
1. Comparar comportamentos e scores com exemplos autorizados, sem misturar
   observações de preço Pix e cartão, vendedor ou variante.
2. Criar UI de revisão visual opcional que exiba score e evidências separadamente.
3. Determinar fontes reais autorizadas e documentação da conta Mercado Livre.
4. Validar cupons e links com critérios próprios de elegibilidade e proveniência.
5. Homologar envio somente em canal permitido, com confirmação explícita,
   proteção contra duplicidade e aprovação do operador.

**Regra de deploy:** manter a versão operacional em `main` intacta até
revisão dos testes, do impacto e da política de canais.
