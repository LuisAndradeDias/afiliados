# Caça Promos VIP — denúncias internas no Netlify

Um pequeno site público e duas Netlify Functions com Netlify Blobs. Não publica
o painel interno 3045 nem acessa o WhatsApp. O endereço público somente recebe
denúncias confirmadas; o ACER consulta e bloqueia por conexão de saída.

## Publicação

1. Autentique o Netlify CLI no ACER (`netlify login`), ou importe o
   repositório `LuisAndradeDias/afiliados` na sua conta Netlify.
2. Base directory: `captacao/caca-promos-vip/denuncias-netlify`,
   publish: `public`, Functions: `netlify/functions`.
3. Configure a variável de ambiente **Functions / Production**:
   `CPV_DENUNCIA_NETLIFY_SECRET` = 64 caracteres hexadecimais.
   Use exatamente o mesmo segredo salvo no ACER em
   `dados/previa-acer/denuncias-netlify-segredo-local.txt`.
   Jamais publique o segredo no GitHub.
4. Depois de publicar e conhecer a URL HTTPS, rode o script local:
   `powershell -File scripts/configurar-netlify-local.ps1 -SiteUrl https://SEU-SITE.netlify.app`
   (a partir de `captacao/caca-promos-vip`), para criar o arquivo privado
   `dados/previa-acer/denuncias-netlify-config.json`, depois reinicie
   o servidor na porta 3045.
5. No painel, abra Denúncias internas recebidas e confirme se o Netlify está
   conectado. Clique em Buscar denúncias no Netlify agora para testar.

As Functions e os blobs usam apenas tokens assinados; o telefone e o nome nunca
são enviados ao Netlify. O Netlify confirma o recebimento e o ACER descadastra
o contato depois da sincronização. GET e prévias não registram reclamações.

**O WhatsApp Web não possui botões interativos nativos.** A mensagem terá
um link HTTPS clicável para esta página. Sem segredo e URL configurados,
o sistema mantém SAIR/DENUNCIAR por texto.

**Custos:** Netlify Functions e Blobs podem usar o plano Free, sujeito ao teto
mensal de créditos e às condições aplicáveis à conta.
