# Inicializador do painel Afiliados (Windows)

Dê dois cliques em **Iniciar-Painel-Afiliados.exe** na raiz do projeto.

O programa verifica a porta configurada por PAINEL_PORT (valor padrao: 3030).
- Se o painel ja estiver disponivel, abre o navegador e nao inicia outro processo.
- Se estiver fechado, inicia npm run painel em segundo plano, aguarda o HTTP responder e abre o navegador.
- Se a porta estiver ocupada por outro servico, avisa em vez de provocar conflito.
- Logs de inicializacao: data/logs/painel-launcher.log.
- Nao inicia diretamente o robô de envios nem executa scripts de WhatsApp.

Para recompilar em Windows com .NET Framework 4:

    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\launcher\build-launcher.ps1

O .exe deve ficar ao lado do package.json e da pasta scripts\launcher.
Opção tecnica de teste: --no-browser (nao abre a aba).
