/**
 * Caçador VIP / MELI-15C — orquestrador de consulta sob autorização.
 *
 * ATENÇÃO: nenhum adaptador HTTP, scraping ou acesso ao Mercado Livre
 * é instalado aqui. A autorização para robôs/limites de tráfego não foi
 * comprovada para a conta de afiliado. A execução é manual/injetada e
 * permanece fechada quando não há concessão específica.
 *
 * 1 consulta simultânea, teto por hora/dia, descanso dinâmico,
 * dedup por produto, 401/403 => bloqueio, 429 => pausa sem retry.
 */
export type Origem = "fixture" | "feed_autorizado";
export type EstadoCacada =
  | "consultado" | "aguardando" | "sem_permissao" | "ocupado"
  | "limite" | "fonte_bloqueada" | "falha";

export interface Concessao {
  fonte: Origem;
  confirmada: boolean;
  escopoPesquisaProdutos: boolean;
  referenciaEscrita: string;
  expiraEmUtc: string;
}
export interface Pauta {
  id: string;
  palavraChave: string;
  categoria: string;
  interesse: number; // 1 a 5
}
export interface Achado {
  id: string;
  titulo: string;
  vendedor: string;
  variante: string;
  modalidade: "pix" | "cartao" | "geral";
  precoCentavos: number;
  freteCentavos: number | null;
  estoqueConfirmado: boolean;
  observadoEmUtc: string;
}
export interface RespostaDaFonte {
  status: number; // HTTP sintético do adaptador; NÃO é resposta da API do ML
  itens?: Achado[];
  retryAfterMs?: number;
}
export interface FonteInjetada {
  origem: Origem;
  consultar(pauta: Pauta): Promise<RespostaDaFonte>;
}
export interface DiagnosticoCacada {
  estado: EstadoCacada;
  pauta?: string;
  motivo: string;
  recebidos: number;
  novos: number;
  alterados: number;
  repetidos: number;
  bloqueados: number;
  consultasFeitas: number;
  proximaEmUtc: string | null;
  autorizada: boolean;
  publicou: false;
  enviouWhatsapp: false;
}
export interface EstadoMotor {
  tipo: "CACADOR_MELI_FAIL_CLOSED";
  origem: Origem;
  modo: "laboratorio" | "operacional";
  estadoFonte: "nao_autorizada" | "autorizada_declarada" | "bloqueada_403";
  chamadasNoPeriodo: number;
  chamadasHoje: number;
  proximaEmUtc: string | null;
  totalIdentidades: number;
  totalObservacoes: number;
  enviouWhatsapp: false;
}
interface MemoriaPauta {
  pauta: Pauta;
  proximaEm: number;
  errosConsecutivos: number;
  ciclosSemMudanca: number;
  visitas: number;
}
const MIN_GAP = 60_000;     // no máximo uma chamada a cada 60 segundos
const HOUR_BUDGET = 12;     // <= 12 chamadas/hora
const DAY_BUDGET = 60;      // <= 60 chamadas/24h
const MAX_PRODUCTS = 30;    // nunca aceitar lote sem limites
const MAX_MEMORY = 600;     // limite fixo de identidades em memória
const TWENTY_FOUR_HOURS = 86_400_000;
const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
function dataUtc(value: string): number {
  if(typeof value!=="string"||!UTC_ISO.test(value))throw Error("timestamp_invalido");
  const n=Date.parse(value);
  if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,19)!==value.slice(0,19))
    throw Error("timestamp_invalido");
  return n;
}
function validarPauta(p: Pauta): void {
  if(!p||!/^[-_a-z0-9]{3,60}$/i.test(p.id)||
    !/^[\p{L}\p{N}][\p{L}\p{N} \-]{2,65}$/u.test(p.palavraChave)||
    !/^[\p{L}\p{N}][\p{L}\p{N} \-]{2,60}$/u.test(p.categoria)||
    !Number.isInteger(p.interesse)||p.interesse<1||p.interesse>5)
    throw Error("pauta_invalida");
}
function concessaoValida(c:Concessao,fonte:Origem,agora:number,modo:"laboratorio"|"operacional"):boolean {
  if(modo==="laboratorio")return fonte==="fixture";
  if(fonte!=="feed_autorizado"||c.fonte!=="feed_autorizado"||
     !c.confirmada||!c.escopoPesquisaProdutos||
     typeof c.referenciaEscrita!=="string"||
     !/^[A-Za-z0-9:_./-]{15,400}$/.test(c.referenciaEscrita))return false;
  try{return dataUtc(c.expiraEmUtc)>agora;}catch{return false;}
}
function hash(texto:string):number {
  let h=2166136261;
  for(let i=0;i<texto.length;i++)h=Math.imul(h^texto.charCodeAt(i),16777619);
  return h>>>0;
}
function normalizar(item:Achado,agora:number):Achado|null {
  if(!item||!/^MLB\d{6,20}$/.test(item.id)||
    typeof item.titulo!=="string"||item.titulo.trim().length<5||
    item.titulo.length>160||/[\x00-\x1f\x7f]/.test(item.titulo)||
    !/^[A-Za-z0-9_-]{2,64}$/.test(item.vendedor)||
    !/^[A-Za-z0-9_-]{2,64}$/.test(item.variante)||
    !["pix","cartao","geral"].includes(item.modalidade)||
    !Number.isSafeInteger(item.precoCentavos)||item.precoCentavos<=0||
    item.precoCentavos>100_000_000||
    !(item.freteCentavos===null||
      (Number.isSafeInteger(item.freteCentavos)&&item.freteCentavos>=0&&
       item.freteCentavos<=10_000_000))||
    typeof item.estoqueConfirmado!=="boolean")return null;
  try {
    const obs=dataUtc(item.observadoEmUtc);
    if(obs>agora+60_000||obs<agora-48*3600_000)return null;
  }catch{return null;}
  return {...item,titulo:item.titulo.trim()};
}
export function identidade(item:Achado):string {
  return [item.id,item.vendedor,item.variante,item.modalidade].join("|");
}
export class CacadorMeli {
  private readonly pautas:MemoriaPauta[];
  private readonly historico=new Map<string,Achado[]>();
  private readonly timestamps:number[]=[];
  private emExecucao=false;
  private bloqueada=false;
  private cooldownAte=0;
  private ultimaConsulta=-Infinity;
  private totalConsultas=0;
  constructor(private readonly opcoes:{
    fonte:FonteInjetada;
    modo:"laboratorio"|"operacional";
    concessao:Concessao;
    pautas:readonly Pauta[];
    agora?:()=>number;
  }){
    if(!opcoes.fonte||!["fixture","feed_autorizado"].includes(opcoes.fonte.origem)||
       typeof opcoes.fonte.consultar!=="function")throw Error("fonte_invalida");
    if(opcoes.pautas.length===0||opcoes.pautas.length>80)throw Error("pautas_invalidas");
    const seen=new Set<string>();
    this.pautas=opcoes.pautas.map(p=>{
      validarPauta(p);
      if(seen.has(p.id))throw Error("pauta_duplicada");
      seen.add(p.id);
      return {pauta:{...p},proximaEm:0,errosConsecutivos:0,ciclosSemMudanca:0,visitas:0};
    });
  }
  private time():number {
    const value=this.opcoes.agora?.()??Date.now();
    if(!Number.isFinite(value)||value<0)throw Error("relogio_invalido");
    return value;
  }
  private tentativasRecentes(agora:number,janela:number):number{
    return this.timestamps.filter(t=>t>agora-janela&&t<=agora).length;
  }
  private proximaConsulta(agora:number):number{
    const dosLimites=[
      this.ultimaConsulta+MIN_GAP,this.cooldownAte,
    ];
    if(this.tentativasRecentes(agora,3600_000)>=HOUR_BUDGET){
      const recent=this.timestamps.filter(t=>t>agora-3600_000);
      dosLimites.push(recent[recent.length-HOUR_BUDGET]!+3600_000+1);
    }
    if(this.tentativasRecentes(agora,TWENTY_FOUR_HOURS)>=DAY_BUDGET){
      const recent=this.timestamps.filter(t=>t>agora-TWENTY_FOUR_HOURS);
      dosLimites.push(recent[recent.length-DAY_BUDGET]!+TWENTY_FOUR_HOURS+1);
    }
    return Math.max(0,...dosLimites);
  }
  private escolher(agora:number):MemoriaPauta|null {
    const elegiveis=this.pautas.filter(p=>p.proximaEm<=agora);
    if(!elegiveis.length)return null;
    const score=(p:MemoriaPauta)=>{
      const atraso=Math.min(720,Math.max(0,(agora-p.proximaEm)/60_000));
      return p.pauta.interesse*90+atraso/8-
        p.visitas*8-p.errosConsecutivos*12+
        (p.visitas===0?120:0);
    };
    elegiveis.sort((a,b)=>score(b)-score(a)||
      a.proximaEm-b.proximaEm||
      a.pauta.id.localeCompare(b.pauta.id));
    return elegiveis[0]!;
  }
  private relatorio(
    estado:EstadoCacada,motivo:string,agora:number,pauta?:string,
    extras:Partial<Pick<DiagnosticoCacada,"recebidos"|"novos"|
      "alterados"|"repetidos"|"bloqueados">>={}
  ):DiagnosticoCacada{
    const proximo=this.proximaConsulta(agora);
    const futurePauta=Math.min(...this.pautas.map(p=>p.proximaEm));
    const next=this.bloqueada?null:Math.max(proximo,futurePauta);
    return {
      estado,pauta,motivo,recebidos:0,novos:0,alterados:0,repetidos:0,
      bloqueados:0,consultasFeitas:this.totalConsultas,
      proximaEmUtc:next!==null?new Date(Math.max(next,agora)).toISOString():null,
      autorizada:concessaoValida(this.opcoes.concessao,
        this.opcoes.fonte.origem,agora,this.opcoes.modo),
      publicou:false,enviouWhatsapp:false,...extras
    };
  }
  estado():EstadoMotor{
    const now=this.time();
    const licensed=concessaoValida(this.opcoes.concessao,
      this.opcoes.fonte.origem,now,this.opcoes.modo);
    const status=this.relatorio("aguardando","",now);
    return {
      tipo:"CACADOR_MELI_FAIL_CLOSED",origem:this.opcoes.fonte.origem,
      modo:this.opcoes.modo,
      estadoFonte:this.bloqueada?"bloqueada_403":
        licensed?"autorizada_declarada":"nao_autorizada",
      chamadasNoPeriodo:this.tentativasRecentes(now,3600_000),
      chamadasHoje:this.tentativasRecentes(now,TWENTY_FOUR_HOURS),
      proximaEmUtc:status.proximaEmUtc,
      totalIdentidades:this.historico.size,
      totalObservacoes:[...this.historico.values()].reduce((s,a)=>s+a.length,0),
      enviouWhatsapp:false
    };
  }
  observacoes(chave:string):ReadonlyArray<Achado>{
    return (this.historico.get(chave)??[]).map(v=>({...v}));
  }
  async passo():Promise<DiagnosticoCacada>{
    const now=this.time();
    if(this.emExecucao)return this.relatorio("ocupado","Já existe uma consulta em execução.",now);
    if(this.bloqueada)return this.relatorio("fonte_bloqueada",
      "A origem retornou acesso negado; não haverá nova tentativa automática.",now);
    if(!concessaoValida(this.opcoes.concessao,
      this.opcoes.fonte.origem,now,this.opcoes.modo)){
      return this.relatorio("sem_permissao",
        "Nenhuma autorização válida para busca automática de produtos foi comprovada.",now);
    }
    const proxima=this.proximaConsulta(now);
    if(proxima>now)return this.relatorio("limite",
      "Respeitando intervalo, quota diária/horária ou Retry-After.",now);
    const pautas=this.escolher(now);
    if(!pautas)return this.relatorio("aguardando",
      "Nenhuma pauta precisa ser consultada antes do próximo prazo.",now);
    this.emExecucao=true;
    // Reserva ANTES do await: impede duas consultas simultâneas ou estouro de quota.
    this.timestamps.push(now);
    this.ultimaConsulta=now;this.totalConsultas++;
    while(this.timestamps.length && this.timestamps[0]!<=now-TWENTY_FOUR_HOURS)
      this.timestamps.shift();
    // Prazos mínimos: nenhuma repetição em loop, mesmo diante de exceção.
    pautas.proximaEm=now+30*60_000;
    pautas.visitas++;
    try{
      let response:RespostaDaFonte;
      try{response=await this.opcoes.fonte.consultar({...pautas.pauta});}
      catch{
        pautas.errosConsecutivos++;
        pautas.proximaEm=now+Math.min(6*3600_000,
          5*60_000*Math.pow(2,pautas.errosConsecutivos-1));
        return this.relatorio("falha","Falha do adaptador; espera progressiva, sem tentativas em loop.",now,pautas.pauta.id);
      }
      if(!response||typeof response.status!=="number"||
         !Number.isInteger(response.status)){
        pautas.errosConsecutivos++;
        pautas.proximaEm=now+15*60_000;
        return this.relatorio("falha",
          "Resposta da origem inconsistente; nenhuma oferta foi aceita.",
          now,pautas.pauta.id);
      }
      if(response.status===401||response.status===403){
        this.bloqueada=true;
        return this.relatorio("fonte_bloqueada",
          "Permissão negada (401/403). Caçador interrompido, sem contornar o bloqueio.",
          now,pautas.pauta.id);
      }
      if(response.status===429){
        const retry=typeof response.retryAfterMs==="number"&&
          Number.isSafeInteger(response.retryAfterMs)&&response.retryAfterMs>0?
          response.retryAfterMs:15*60_000;
        if(retry>7*TWENTY_FOUR_HOURS){
          this.bloqueada=true;
          return this.relatorio("fonte_bloqueada",
            "Retry-After muito longo; interrompido até revisão humana.",
            now,pautas.pauta.id);
        }
        this.cooldownAte=now+Math.max(15*60_000,retry);
        pautas.proximaEm=this.cooldownAte;
        return this.relatorio("limite",
          "Limite informado pela origem; pausa sem retry automático.",
          now,pautas.pauta.id);
      }
      if(response.status!==200||!Array.isArray(response.itens)||
         response.itens.length>MAX_PRODUCTS){
        pautas.errosConsecutivos++;
        pautas.proximaEm=now+Math.min(6*3600_000,
          5*60_000*Math.pow(2,pautas.errosConsecutivos-1));
        return this.relatorio("falha",
          "Resposta inválida ou indisponível. Nenhum item aceito.",now,pautas.pauta.id);
      }
      let novos=0,alterados=0,repetidos=0,bloqueados=0;
      const seen=new Set<string>();
      for(const raw of response.itens){
        const item=normalizar(raw,now);
        if(!item){bloqueados++;continue;}
        const id=identidade(item);
        if(seen.has(id)){
          const anterior=this.historico.get(id)?.at(-1);
          if(anterior && anterior.observadoEmUtc===item.observadoEmUtc &&
             (anterior.precoCentavos!==item.precoCentavos||
              anterior.freteCentavos!==item.freteCentavos||
              anterior.estoqueConfirmado!==item.estoqueConfirmado)){
            bloqueados++;
          }else repetidos++;
          continue;
        }
        seen.add(id);
        const previous=this.historico.get(id);
        if(!previous&&this.historico.size>=MAX_MEMORY){bloqueados++;continue;}
        if(!previous){this.historico.set(id,[item]);novos++;continue;}
        const last=previous.at(-1)!;
        if(last.observadoEmUtc===item.observadoEmUtc){
          // Conflicts at same instant are rejected, not overwritten.
          if(last.precoCentavos===item.precoCentavos&&
             last.freteCentavos===item.freteCentavos&&
             last.estoqueConfirmado===item.estoqueConfirmado)repetidos++;
          else bloqueados++;
          continue;
        }
        if(dataUtc(item.observadoEmUtc)<=dataUtc(last.observadoEmUtc)){
          bloqueados++;continue;
        }
        if(last.precoCentavos===item.precoCentavos&&
           last.freteCentavos===item.freteCentavos&&
           last.estoqueConfirmado===item.estoqueConfirmado)repetidos++;
        else alterados++;
        previous.push(item);
        if(previous.length>20)previous.splice(0,previous.length-20);
      }
      pautas.errosConsecutivos=0;
      pautas.ciclosSemMudanca=(novos+alterados)===0?
        pautas.ciclosSemMudanca+1:0;
      // O menor prazo de retomada é 30 min; sem mudanças, até 12h.
      const base=pautas.ciclosSemMudanca===0?
        (pautas.pauta.interesse>=4?30:90)*60_000:
        Math.min(12,Math.pow(2,Math.min(6,pautas.ciclosSemMudanca)))*3600_000;
      const espalhamento=hash(pautas.pauta.id+"|"+pautas.visitas)%120_000;
      pautas.proximaEm=now+base+espalhamento;
      return this.relatorio("consultado",
        "Resultado processado localmente; nenhum produto foi publicado.",
        now,pautas.pauta.id,
        {recebidos:response.itens.length,novos,alterados,repetidos,bloqueados});
    }finally{this.emExecucao=false;}
  }
}
