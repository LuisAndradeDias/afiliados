/**
 * MELI-11 — armazenamento e agendamento isolados, sem cliente de rede.
 * A integração oficial requer adaptador e permissão documental revisados.
 * Não cria ofertas nem aciona WhatsApp.
 */
import {createHash} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
export type Pagamento = "pix"|"cartao";
export type Disponibilidade = "confirmada"|"indeterminada"|"indisponivel";
export interface Observacao {
  itemId:string;titulo:string;vendedorId:string;varianteId:string;
  pagamento:Pagamento;moeda:"BRL";centavos:number;
  observadoEm:string;disponibilidade:Disponibilidade;
}
export interface Permissao {
  referencia:string;fonte:string;escopo:"afiliados_autorizados";
  aprovada:true;retencaoDias:number;
}
export interface Fonte {
  identificador:string;
  coletar(signal:AbortSignal):Promise<ReadonlyArray<Observacao>>;
}
export interface Amostra {
  observadoEm:string;centavos:number;disponibilidade:Disponibilidade;
}
export interface ItemHistorico {
  id:string;itemId:string;titulo:string;vendedorId:string;varianteId:string;
  pix:Amostra[];cartao:Amostra[];
}
export type Estado = "aguardando_autorizacao"|"aguardando_fonte"|"coletando"|
  "atualizado"|"erro_fonte"|"permissao_negada"|"limite_atingido";
const DIA=86_400_000;
const IDENT=/^[A-Za-z0-9_-]{1,72}$/;
const DATA=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
function utc(t:string):string {
  if(!DATA.test(t))throw Error("Horario UTC invalido");
  const ms=Date.parse(t);
  if(!Number.isFinite(ms)||ms<Date.parse("2020-01-01T00:00:00Z"))throw Error("Horario UTC invalido");
  const n=new Date(ms).toISOString();
  if(n.slice(0,19)!==t.slice(0,19))throw Error("Data UTC impossivel");
  return n;
}
function permitida(p:Permissao|null):p is Permissao {
  return !!p&&p.aprovada===true&&p.escopo==="afiliados_autorizados"&&
    IDENT.test(p.referencia)&&IDENT.test(p.fonte)&&
    Number.isSafeInteger(p.retencaoDias)&&p.retencaoDias>=1&&p.retencaoDias<=90;
}
function validar(o:Observacao,agora:number,retencao:number):string {
  if(!/^MLB\d{6,20}$/.test(o.itemId)||typeof o.titulo!=="string"||
    !o.titulo.trim()||o.titulo.length>120||!IDENT.test(o.vendedorId)||
    !IDENT.test(o.varianteId)||!["pix","cartao"].includes(o.pagamento)||
    o.moeda!=="BRL"||!["confirmada","indeterminada","indisponivel"].includes(o.disponibilidade)||
    !Number.isSafeInteger(o.centavos)||o.centavos<=0||o.centavos>100_000_000_000)
    throw Error("Cotacao invalida");
  const data=utc(o.observadoEm),time=Date.parse(data);
  if(time>agora+60_000||time<agora-retencao*DIA)throw Error("Cotacao fora da retencao");
  return data;
}
function chave(o:Observacao,em:string):string {
  return createHash("sha256").update(JSON.stringify([
    o.itemId,o.vendedorId,o.varianteId,o.pagamento,em
  ])).digest("hex");
}
/** SQLite: atomicidade, identidade por vendedor/variante e conflito irrecuperável. */
export class HistoricoMeli11Store {
  private readonly db:DatabaseSync;
  constructor(arquivo=":memory:"){
    this.db=new DatabaseSync(arquivo);
    this.db.exec("PRAGMA busy_timeout=3000; PRAGMA foreign_keys=ON;");
    this.db.exec([
      "CREATE TABLE IF NOT EXISTS meli11_obs(",
      "chave TEXT PRIMARY KEY,item_id TEXT NOT NULL,titulo TEXT NOT NULL,",
      "vendedor TEXT NOT NULL,variante TEXT NOT NULL,",
      "pagamento TEXT NOT NULL CHECK(pagamento IN ('pix','cartao')),",
      "moeda TEXT NOT NULL CHECK(moeda='BRL'),",
      "centavos INTEGER NOT NULL CHECK(centavos>0),",
      "observado TEXT NOT NULL,disponibilidade TEXT NOT NULL",
      "CHECK(disponibilidade IN ('confirmada','indeterminada','indisponivel')),",
      "fonte TEXT NOT NULL,licenca TEXT NOT NULL);",
      "CREATE INDEX IF NOT EXISTS idx_meli11_obs ON meli11_obs(item_id,vendedor,variante,observado);",
      "CREATE INDEX IF NOT EXISTS idx_meli11_tempo ON meli11_obs(observado);"
    ].join(" "));
  }
  salvarLote(lote:ReadonlyArray<Observacao>,p:Permissao|null,
    agoraIso=new Date().toISOString()):{inseridas:number,repetidas:number}{
    if(!permitida(p))throw Error("Sem autorizacao documental");
    if(!Array.isArray(lote)||lote.length>80)throw Error("Lote acima do limite");
    const agora=Date.parse(utc(agoraIso));
    const aprovadas=lote.map(o=>({o,em:validar(o,agora,p.retencaoDias)}));
    let inseridas=0,repetidas=0;
    this.db.exec("BEGIN IMMEDIATE");
    try{
      const get=this.db.prepare("SELECT centavos,disponibilidade,fonte,licenca FROM meli11_obs WHERE chave=?");
      const put=this.db.prepare([
        "INSERT INTO meli11_obs(chave,item_id,titulo,vendedor,variante,pagamento,moeda,",
        "centavos,observado,disponibilidade,fonte,licenca) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)"
      ].join(" "));
      for(const {o,em} of aprovadas){
        const id=chave(o,em);
        const existe=get.get(id) as {centavos:number;disponibilidade:string;
          fonte:string;licenca:string}|undefined;
        if(existe){
          if(existe.centavos!==o.centavos||existe.disponibilidade!==o.disponibilidade||
             existe.fonte!==p.fonte||existe.licenca!==p.referencia)
            throw Error("Conflito imutavel entre cotacoes");
          repetidas++;continue;
        }
        put.run(id,o.itemId,o.titulo.trim(),o.vendedorId,o.varianteId,
          o.pagamento,o.moeda,o.centavos,em,o.disponibilidade,p.fonte,p.referencia);
        inseridas++;
      }
      this.db.exec("COMMIT");
      return {inseridas,repetidas};
    }catch(e){this.db.exec("ROLLBACK");throw e;}
  }
  expurgar(p:Permissao,agoraIso=new Date().toISOString()):number{
    if(!permitida(p))throw Error("Retencao sem autorizacao");
    const corte=new Date(Date.parse(utc(agoraIso))-p.retencaoDias*DIA).toISOString();
    return Number(this.db.prepare("DELETE FROM meli11_obs WHERE observado<?").run(corte).changes);
  }
  consultar(p:Permissao|null,agoraIso=new Date().toISOString()):ItemHistorico[]{
    if(!permitida(p))return [];
    const agora=Date.parse(utc(agoraIso));
    const corte=new Date(agora-p.retencaoDias*DIA).toISOString();
    const rows=this.db.prepare([
      "SELECT item_id,titulo,vendedor,variante,pagamento,centavos,observado,disponibilidade",
      "FROM meli11_obs WHERE licenca=? AND fonte=? AND observado>=? AND observado<=?",
      "ORDER BY observado DESC,item_id ASC LIMIT 8000"
    ].join(" ")).all(p.referencia,p.fonte,corte,new Date(agora).toISOString()) as Array<{
      item_id:string;titulo:string;vendedor:string;variante:string;
      pagamento:Pagamento;centavos:number;observado:string;disponibilidade:Disponibilidade;
    }>;
    const itens=new Map<string,ItemHistorico>();
    for(const r of rows){
      const id=[r.item_id,r.vendedor,r.variante].join("|");
      let item=itens.get(id);
      if(!item){
        if(itens.size>=80)continue;
        item={id,itemId:r.item_id,titulo:r.titulo,vendedorId:r.vendedor,
          varianteId:r.variante,pix:[],cartao:[]};
        itens.set(id,item);
      }
      const lista=item[r.pagamento];
      if(lista.length<100)lista.push({observadoEm:r.observado,centavos:r.centavos,
        disponibilidade:r.disponibilidade});
    }
    return [...itens.values()].map(i=>({...i,pix:i.pix.reverse(),cartao:i.cartao.reverse()}));
  }
  contar():number {
    return (this.db.prepare("SELECT COUNT(*) AS n FROM meli11_obs").get() as {n:number}).n;
  }
  fechar():void{this.db.close();}
}
export interface Situacao {
  situacao:Estado;coletaHabilitada:boolean;autorizacaoConfirmada:boolean;
  ultimaExecucaoUtc:string|null;proximaExecucaoUtc:string|null;
  mensagem:string;itens:ItemHistorico[];
}
export interface Configuracao {
  fonte?:Fonte|null;permissao?:Permissao|null;arquivo?:string;intervaloMs?:number;
  timeoutMs?:number;habilitado?:boolean;agora?:()=>number;
}
export class PipelineMeli11 {
  private readonly fonte:Fonte|null;
  private readonly permissao:Permissao|null;
  private readonly habilitado:boolean;
  private readonly intervalo:number;
  private readonly timeout:number;
  private readonly agora:()=>number;
  private store:HistoricoMeli11Store|null=null;
  private timer:ReturnType<typeof setTimeout>|null=null;
  private running:Promise<void>|null=null;
  private fechado=false;
  private estado:Estado="aguardando_autorizacao";
  private ultima:string|null=null;
  private proxima:string|null=null;
  private mensagem="Aguardando fonte oficial autorizada.";
  constructor(private readonly config:Configuracao={}){
    this.fonte=config.fonte??null;this.permissao=config.permissao??null;
    this.habilitado=config.habilitado===true;
    this.intervalo=Math.max(30*60_000,Math.min(24*60*60_000,config.intervaloMs??3600000));
    this.timeout=Math.max(1000,Math.min(15000,config.timeoutMs??10000));
    this.agora=config.agora??Date.now;
  }
  private liberada():boolean {
    return !this.fechado&&this.estado!=="permissao_negada"&&
      this.habilitado&&!!this.fonte&&permitida(this.permissao)&&
      this.fonte.identificador===this.permissao.fonte;
  }
  private banco():HistoricoMeli11Store {
    if(!this.store)this.store=new HistoricoMeli11Store(this.config.arquivo??":memory:");
    return this.store;
  }
  async executarUmaVez():Promise<void>{
    // Uma negacao 403 bloqueia futuras chamadas ate nova revisao/instancia.
    if(this.estado==="permissao_negada")return;
    if(!this.liberada()){
      this.estado=permitida(this.permissao)?"aguardando_fonte":"aguardando_autorizacao";
      this.mensagem="Coleta bloqueada. Nenhum pedido externo realizado.";
      return;
    }
    if(this.running)return this.running;
    const executar=async()=>{
      this.estado="coletando";
      const ctrl=new AbortController();
      const alarm=setTimeout(()=>ctrl.abort(),this.timeout);
      try{
        const lote=await this.fonte!.coletar(ctrl.signal);
        const agora=new Date(this.agora()).toISOString();
        this.banco().salvarLote(lote,this.permissao,agora);
        this.banco().expurgar(this.permissao!,agora);
        this.ultima=agora;this.estado="atualizado";
        this.mensagem="Sincronizado. Nenhum envio autorizado por este processo.";
      }catch(e){
        const code=typeof e==="object"&&e!==null&&"code" in e?
          String((e as {code?:unknown}).code):"";
        if(code==="MERCADOLIVRE_PERMISSION_REQUIRED"){
          this.estado="permissao_negada";
          this.mensagem="HTTP 403: coleta parada até nova autorização.";
          this.cancelar();
        }else if(code==="MERCADOLIVRE_RATE_LIMIT"){
          this.estado="limite_atingido";
          this.mensagem="Limite: sem repetição imediata.";
        }else{
          this.estado="erro_fonte";
          this.mensagem="Falha controlada, sem alterar histórico anterior.";
        }
      }finally{clearTimeout(alarm);}
    };
    this.running=executar().finally(()=>{this.running=null;});
    return this.running;
  }
  iniciar():void{
    if(this.estado==="permissao_negada")return;
    if(!this.liberada()){
      this.estado="aguardando_autorizacao";
      this.mensagem="Coleta ainda bloqueada: exige fonte oficial e permissão revisada.";
      return;
    }
    if(this.timer||this.running)return;
    const turno=async()=>{
      await this.executarUmaVez();
      if(this.fechado||this.estado==="permissao_negada")return;
      this.proxima=new Date(this.agora()+this.intervalo).toISOString();
      this.timer=setTimeout(()=>{this.timer=null;void turno();},this.intervalo);
      this.timer.unref?.();
    };
    void turno();
  }
  private cancelar():void{
    if(this.timer)clearTimeout(this.timer);
    this.timer=null;this.proxima=null;
  }
  situacao():Situacao{
    const pode=this.liberada();
    return {situacao:this.estado,coletaHabilitada:pode,autorizacaoConfirmada:pode,
      ultimaExecucaoUtc:this.ultima,proximaExecucaoUtc:this.proxima,
      mensagem:this.mensagem,itens:pode?
      this.banco().consultar(this.permissao,new Date(this.agora()).toISOString()):[]};
  }
  async fechar():Promise<void>{
    this.fechado=true;this.cancelar();await this.running;
    this.store?.fechar();this.store=null;
  }
}
