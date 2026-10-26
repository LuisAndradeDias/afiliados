/** Manifesto explícito de ativos e do modelo autorizado. Sem paths fornecidos pelo HTTP. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function carregarAtivos(sourceDir) {
  const planilhaModelo = readFileSync(join(sourceDir, '..', 'modelos', 'Modelo_Contatos_Autorizados.xlsx'));
  const scripts = new Map([
    ['/assets/landing.js', readFileSync(join(sourceDir, 'assets', 'landing.js'), 'utf8')],
    ['/assets/campanhas.js', readFileSync(join(sourceDir, 'assets', 'campanhas.js'), 'utf8')],
    ['/assets/envio-rapido.js', readFileSync(join(sourceDir, 'assets', 'envio-rapido.js'), 'utf8')],
    ['/assets/gestao.js', readFileSync(join(sourceDir, 'assets', 'gestao.js'), 'utf8')],
    ['/assets/descadastro.js', readFileSync(join(sourceDir, 'assets', 'descadastro.js'), 'utf8')],
    ['/assets/denuncia.js', readFileSync(join(sourceDir, 'assets', 'denuncia.js'), 'utf8')],
    ['/assets/respostas-botoes.js', readFileSync(join(sourceDir, 'assets', 'respostas-botoes.js'), 'utf8')],
    ['/assets/layout-clean.js', readFileSync(join(sourceDir, 'assets', 'layout-clean.js'), 'utf8')],
  ]);
  const styles=new Map([
    ['/assets/painel-theme.css',readFileSync(join(sourceDir,'assets','painel-theme.css'),'utf8')],
    ['/assets/layout-clean.css',readFileSync(join(sourceDir,'assets','layout-clean.css'),'utf8')],
    ['/assets/afiliados-v2.tokens.css',readFileSync(join(sourceDir,'assets','afiliados-v2.tokens.css'),'utf8')],
    ['/assets/afiliados-v2.css',readFileSync(join(sourceDir,'assets','afiliados-v2.css'),'utf8')],
    ['/assets/envio-rapido.css',readFileSync(join(sourceDir,'assets','envio-rapido.css'),'utf8')],
  ]);

  return { planilhaModelo, scripts, styles };
}
