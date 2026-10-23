# Mercado Livre OAuth no novo computador (sem expor a Central)

O painel de promocoes atende SOMENTE em `http://127.0.0.1:3030`.

Para autorizacao OAuth de testes, use uma ponte local, limitada a UMA unica
rota HTTP (`GET /oauth/mercadolivre/callback`), na porta 3031.

A ponte esta em `scripts/mercadolivre-oauth-bridge.mjs`. NUNCA direcione
um tunel publico para a porta 3030: a Central tem acoes administrativas
locais e nao foi desenvolvida para ficar exposta publicamente.

## Iniciar ou recuperar o callback

Abra dois terminais PowerShell com o painel ja rodando:

```powershell
cd C:\projeto01
node .\scripts\mercadolivre-oauth-bridge.mjs
```

No segundo terminal, use o binario oficial do Cloudflare em disco C:

```powershell
C:\projeto01\tools\cloudflared\cloudflared.exe tunnel --no-autoupdate --url http://127.0.0.1:3031
```

O Cloudflare fornece um novo endereco aleatorio `https://*.trycloudflare.com`.
Acrescente exatamente `/oauth/mercadolivre/callback` a esse endereco.

1. Confirme que a URL publica responde HTTP 400 ao abrir o callback sem
   `code/state`. A raiz e `/api/action` DEVEM responder 404.
2. Atualize o campo **Redirect URI** do aplicativo no DevCenter do Mercado Livre.
3. No painel, use **Configuracoes das contas > Mercado Livre API >
   Salvar Redirect**, colando EXATAMENTE a mesma URL HTTPS.
4. No painel, clique em **Autorizar OAuth** e aprove o acesso na conta titular.
   O Mercado Livre volta pela ponte; a ponte encaminha o codigo e o state
   ao painel LOCAL e redireciona o navegador de volta ao localhost.
5. Confira `/api/status`: `mercadoLivreApiConfigurada=true` indica
   que o token foi recebido (isso NAO inicia busca, WhatsApp nem envios).

**Atencao:** Quick Tunnels sao temporarios. O dominio muda ao reiniciar o
processo. Isso e adequado para uma autorizacao de testes, nao para uma
integracao HTTPS estavel de producao. Para um callback permanente, use
um Cloudflare Tunnel nomeado em um dominio que o titular controle, ainda
expondo somente a porta 3031. Mantenha a janela do tunel aberta ate a
autorizacao terminar.

Nao registre `code`, `state`, tokens, segredos ou mensagens completas
em logs ou arquivos publicos. O callback usa `state` aleatorio e restricao
de rota, mas quem acessar a URL publica consegue atingir a ponte OAuth.
Nao instale PostgreSQL nem configure autoenvio para realizar esse fluxo.
