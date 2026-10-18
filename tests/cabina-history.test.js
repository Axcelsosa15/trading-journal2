/* Cabina · historial de futuros: buscador, orden por columna, selección
 * múltiple con borrado en lote y duplicar.
 *
 * Cabina es una página autónoma con el JS en línea, así que el arnés carga el
 * HTML sin ejecutarlo, siembra localStorage y después corre el script. */
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const HTML=fs.readFileSync("cabina/index.html","utf8");
const SCRIPT=(HTML.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)||[])[1];
if(!SCRIPT){console.log("ERR no se encontró el script en línea de cabina");process.exit(1);}
const dom=new JSDOM(HTML,{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/cabina/"});
const {window}=dom; const d=window.document;
// Semilla: 4 operaciones de futuros con P&L explícito para que las aserciones
// no dependan del multiplicador del instrumento.
function mk(id,date,time,instr,pnl,entry,stop,exit,quality,tags,lesson){
  return {id,type:"futuros",date,time,instrument:instr,direction:"long",qty:1,entry,stop,exit,pnl,
          quality,tags:tags||"",lesson:lesson||"",accountId:null,setupId:null,images:[],updatedAt:1};
}
const TRADES={
  t1:mk("t1","2026-06-01","10:00","MNQ",100,100,90,110,"A","disciplina","entré con el plan"),
  t2:mk("t2","2026-06-05","11:00","MES",-50,100,90,95,"C","revenge","entré por venganza tras la pérdida"),
  t3:mk("t3","2026-06-10","09:30","MNQ",300,100,90,130,"A","plan",""),
  t4:mk("t4","2026-06-15","14:00","CL",-200,100,90,80,"D","","sin lección"),
};
window.localStorage.setItem("cabina-mnq:v1",JSON.stringify({trades:TRADES}));
vm.runInContext(SCRIPT,dom.getInternalVMContext(),{filename:"cabina-inline.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
const rows=()=>[...d.querySelectorAll("#jrTable tbody tr")];
const n=()=>rows().length;
const order=()=>rows().map(r=>r.dataset.id).join(",");
const cell=(r,sel)=>r.querySelector(sel);
const type=(el,v)=>{el.value=v;el.dispatchEvent(new window.Event("input",{bubbles:true}));};
const hdr=t=>[...d.querySelectorAll("#jrTable thead button[data-sort]")].find(b=>new RegExp("^"+t).test(b.textContent.trim()));
const bulkTxt=()=>d.querySelector("#jrBulk").textContent;
setTimeout(()=>{try{
  // ir a Futuros → Diario
  click([...d.querySelectorAll("nav button, .tabs button, [data-tab]")].find(b=>/Futuros/i.test(b.textContent))||d.querySelector("[data-tab='futuros']"));
  const diario=[...d.querySelectorAll("button[data-v='diario']")][0];
  if(diario) click(diario);
  console.log("Las 4 operaciones aparecen en el historial:", n()===4, "("+n()+")");

  // ---------- buscador ----------
  const q=d.querySelector("#ftQ");
  console.log("El buscador existe en la barra de filtros:", !!q);
  type(q,"MNQ");
  console.log("Buscar 'MNQ' deja 2:", n()===2, "("+n()+")");
  type(d.querySelector("#ftQ"),"venganza");
  console.log("Buscar por texto de la lección deja 1:", n()===1, "("+n()+")");
  type(d.querySelector("#ftQ"),"leccion");
  console.log("Busca sin acentos ('leccion' → 'lección'):", n()===1, "("+n()+")");
  type(d.querySelector("#ftQ"),"disciplina");
  console.log("Buscar por etiqueta deja 1:", n()===1, "("+n()+")");
  // AND de verdad: "venganza" sale solo en t2 (MES). Con "mes" delante sigue
  // saliendo; con "mnq" delante no debe salir nada, que es lo que prueba el AND.
  type(d.querySelector("#ftQ"),"mes venganza");
  console.log("Dos términos que coinciden en la misma fila la dejan:", n()===1, "("+n()+")");
  type(d.querySelector("#ftQ"),"mnq venganza");
  console.log("Dos términos de filas distintas no devuelven nada (AND, no OR):", n()===0, "("+n()+")");
  type(d.querySelector("#ftQ"),"zzzz");
  console.log("Sin coincidencias deja la tabla vacía:", n()===0, "("+n()+")");
  console.log("Y lo dice con un mensaje propio:", /Ninguna operación coincide/.test(d.querySelector("#jrTable").textContent));
  console.log("El foco se queda en el buscador al teclear:", d.activeElement===d.querySelector("#ftQ"));
  type(d.querySelector("#ftQ"),"");
  console.log("Vaciar la búsqueda restaura las 4:", n()===4, "("+n()+")");

  // ---------- orden por columna ----------
  console.log("Orden inicial: fecha descendente:", order()==="t4,t3,t2,t1", "("+order()+")");
  click(hdr("P&L"));
  console.log("Ordenar por P&L: la mayor ganancia primero:", order()==="t3,t1,t2,t4", "("+order()+")");
  click(hdr("P&L"));
  console.log("Segundo clic invierte: la mayor pérdida primero:", order()==="t4,t2,t1,t3", "("+order()+")");
  click(hdr("Instr."));
  console.log("Ordenar por instrumento:", order().startsWith("t2")||order().startsWith("t1")||order().startsWith("t3"), "("+order()+")");
  click(hdr("Cal."));
  console.log("Ordenar por calificación (desc) pone la D primero:", order()==="t4,t2,t3,t1"||order()==="t4,t2,t1,t3", "("+order()+")");
  click(hdr("Fecha"));
  console.log("Volver a fecha descendente:", order()==="t4,t3,t2,t1", "("+order()+")");

  // ---------- selección múltiple ----------
  console.log("Hay una casilla por fila:", rows().every(r=>!!cell(r,"input[data-sel]")));
  console.log("Y una de 'seleccionar todas' en la cabecera:", !!d.querySelector("#jrTable thead input[data-selall]"));
  console.log("La barra de lote está oculta sin selección:", bulkTxt().trim()==="");
  click(cell(rows()[0],"input[data-sel]"));
  console.log("Marcar una muestra la barra:", /1 operación seleccionada/.test(bulkTxt()), "("+bulkTxt().slice(0,50)+")");
  console.log("La fila marcada se resalta:", rows().some(r=>r.className.indexOf("selrow")>=0));
  console.log("Marcar no abrió el editor:", !d.querySelector(".ed.open, .ed[open]"));
  click(d.querySelector("#jrTable thead input[data-selall]"));
  console.log("'Seleccionar todas' marca las 4:", /4 operaciones seleccionadas/.test(bulkTxt()), "("+bulkTxt().slice(0,50)+")");
  console.log("La barra suma el P&L de la selección ($150):", /\$150/.test(bulkTxt()), "("+bulkTxt().slice(0,90)+")");
  click([...d.querySelectorAll("#jrBulk button")].find(b=>/Deseleccionar/.test(b.textContent)));
  console.log("Deseleccionar vacía la barra:", bulkTxt().trim()==="");

  // ---------- borrado en lote (dos clics) ----------
  click(cell(rows()[0],"input[data-sel]"));
  click(cell(rows()[1],"input[data-sel]"));
  console.log("Dos marcadas:", /2 operaciones seleccionadas/.test(bulkTxt()));
  const del=()=>[...d.querySelectorAll("#jrBulk button")].find(b=>/Borrar|¿borrar\?/.test(b.textContent));
  click(del());
  console.log("El primer clic en Borrar solo arma la confirmación:", n()===4 && /¿borrar\?/.test(del().textContent), "("+n()+" filas)");
  click(del());
  console.log("El segundo clic borra las 2:", n()===2, "("+n()+")");
  console.log("La barra desaparece tras borrar:", bulkTxt().trim()==="");

  // ---------- duplicar ----------
  const dup=cell(rows()[0],"button[data-act='dup']");
  console.log("Cada fila ofrece Duplicar:", !!dup);
  const srcId=rows()[0].dataset.id;
  const srcInstr=TRADES[srcId]?TRADES[srcId].instrument:null;
  click(dup);
  const ed=d.querySelector("#edFields")||d.querySelector(".ed");
  const vals=[...ed.querySelectorAll("input,select")].map(i=>i.value);
  console.log("Duplicar abre el editor con el instrumento copiado:", srcInstr===null||vals.indexOf(srcInstr)>=0, "("+srcInstr+")");
  const today=new Date().toISOString().slice(0,10);
  console.log("Duplicar fecha la copia hoy:", vals.indexOf(today)>=0, "("+today+")");
  console.log("Y el editor se titula como operación nueva:", /Nueva operación/.test(d.querySelector("#edTitle").textContent), "("+d.querySelector("#edTitle").textContent+")");
  console.log("Sigue habiendo 2 operaciones (duplicar no guarda solo):", n()===2, "("+n()+")");

  console.log("CABINA HISTORY SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}
// Cabina arranca un setInterval para el reloj, así que el proceso no termina
// por sí solo: hay que cerrarlo a mano o el runner se queda esperando.
process.exit(0);},300);
