/* Historial de operaciones: buscador, orden por columna, selección múltiple
 * con borrado en lote, duplicar y confirmación antes de borrar. */
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
function mk(id,date,sym,pnl,rating,note,tags){return {id,date,time:"10:00",symbol:sym,type:"future",side:"long",contracts:1,entry:5400,exit:5410,setup:"Ruptura",emotion:"Tranquilo",rating,note:note||"",pnl,commission:0,account_id:null,tags:tags||[],mae:"",mfe:"",screenshot_path:null};}
const TRADES=[
  mk("t1","2026-06-01","MES",100,5,"entré tarde en la sesión",["disciplina"]),
  mk("t2","2026-06-05","MNQ",-50,2,"revenge trade",[]),
  mk("t3","2026-06-10","MES",200,4,"",["plan"]),
  mk("t4","2026-06-15","CL",-300,1,"",[]),
];
let deletedIn=null, confirms=[];
function makeFrom(tbl){const b={};b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;
 b.delete=()=>b; b.in=(col,ids)=>{deletedIn=ids.slice();return b;};
 b.then=(res,rej)=>{let data=tbl==="trades"?TRADES.slice():(tbl==="user_settings"?null:[]);return Promise.resolve({data,error:null}).then(res,rej);};return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.confirm=(msg)=>{confirms.push(String(msg));return true;};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
const rows=()=>[...d.querySelectorAll("main button")].filter(b=>b.style.display==="grid");
const rowCount=()=>rows().length;
// Orden de los símbolos tal y como se ven en la lista.
const symOrder=()=>rows().map(r=>(r.textContent.match(/MES|MNQ|CL/)||[""])[0]);
const boxes=()=>[...d.querySelectorAll("main input[type=checkbox]")];
const type=(el,v)=>{el.value=v;el.dispatchEvent(new window.Event("input",{bubbles:true}));};
const goTrades=()=>click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
setTimeout(()=>{try{
  goTrades();
  console.log("Las 4 operaciones se listan:", rowCount()===4, "("+rowCount()+")");

  // ---- buscador ----
  const search=d.querySelector("main input[type=search]");
  console.log("El buscador existe:", !!search);
  type(search,"MES");
  console.log("Buscar 'MES' deja 2:", rowCount()===2, "("+rowCount()+")");
  // sin acentos y por texto de la nota
  type(d.querySelector("main input[type=search]"),"sesion");
  console.log("Buscar 'sesion' encuentra la nota con acento:", rowCount()===1, "("+rowCount()+")");
  // por etiqueta
  type(d.querySelector("main input[type=search]"),"plan");
  console.log("Buscar por etiqueta 'plan' deja 1:", rowCount()===1, "("+rowCount()+")");
  // varios términos = AND
  type(d.querySelector("main input[type=search]"),"mes plan");
  console.log("Dos términos filtran en AND:", rowCount()===1, "("+rowCount()+")");
  type(d.querySelector("main input[type=search]"),"zzzz");
  console.log("Una búsqueda sin resultados deja 0:", rowCount()===0, "("+rowCount()+")");
  click([...d.querySelectorAll("main button")].find(b=>/^Limpiar$/.test(b.textContent.trim())));
  console.log("'Limpiar' restaura las 4:", rowCount()===4, "("+rowCount()+")");

  // ---- orden por columna ----
  console.log("Orden inicial: fecha descendente:", symOrder().join(",")==="CL,MES,MNQ,MES", "("+symOrder().join(",")+")");
  const hdr=t=>[...d.querySelectorAll("main button")].find(b=>b.style.display!=="grid"&&new RegExp("^"+t).test(b.textContent.trim()));
  click(hdr("P&L"));
  console.log("Ordenar por P&L: primero el mayor:", symOrder()[0]==="MES"&&/\+\$200/.test(rows()[0].textContent), "("+symOrder().join(",")+")");
  click(hdr("P&L"));
  console.log("Segundo clic invierte: primero la mayor pérdida:", /−\$300|-\$300/.test(rows()[0].textContent), "("+rows()[0].textContent.slice(0,40)+")");
  click(hdr("Símbolo"));
  console.log("Ordenar por símbolo (desc) empieza por MNQ:", symOrder()[0]==="MNQ", "("+symOrder().join(",")+")");
  click(hdr("Fecha"));
  console.log("Volver a fecha:", symOrder().join(",")==="CL,MES,MNQ,MES", "("+symOrder().join(",")+")");

  // ---- selección múltiple ----
  console.log("Hay una casilla por fila más la de cabecera:", boxes().length===5, "("+boxes().length+")");
  const first=boxes()[1];
  first.checked=true; first.dispatchEvent(new window.Event("change",{bubbles:true}));
  let main=d.querySelector("main").textContent;
  console.log("Marcar una muestra la barra de lote:", /1 operación seleccionada/.test(main));
  console.log("No se abrió el detalle al marcar:", !d.querySelector(".dc-drawer"));
  // seleccionar todas desde la cabecera
  const all=boxes()[0];
  all.checked=true; all.dispatchEvent(new window.Event("change",{bubbles:true}));
  console.log("'Seleccionar todas' marca las 4:", /4 operaciones seleccionadas/.test(d.querySelector("main").textContent));
  // deseleccionar
  click([...d.querySelectorAll("main button")].find(b=>/Deseleccionar/.test(b.textContent)));
  console.log("Deseleccionar oculta la barra:", !/operaciones seleccionadas/.test(d.querySelector("main").textContent));

  // ---- borrado en lote ----
  const b1=boxes()[1]; b1.checked=true; b1.dispatchEvent(new window.Event("change",{bubbles:true}));
  const b2=boxes()[2]; b2.checked=true; b2.dispatchEvent(new window.Event("change",{bubbles:true}));
  confirms=[];
  click([...d.querySelectorAll("main button")].find(b=>/^Eliminar$/.test(b.textContent.trim())));
  setTimeout(()=>{try{
    console.log("El borrado en lote pide confirmación:", confirms.length===1&&/2 operaciones/.test(confirms[0]), "("+(confirms[0]||"").slice(0,60)+")");
    console.log("La confirmación advierte que no se deshace:", /no se puede deshacer/.test(confirms[0]||""));
    console.log("Se borraron las 2 en una sola llamada:", Array.isArray(deletedIn)&&deletedIn.length===2, "("+JSON.stringify(deletedIn)+")");
    console.log("Quedan 2 filas:", rowCount()===2, "("+rowCount()+")");
    console.log("La barra de lote desaparece tras borrar:", !/operaciones seleccionadas/.test(d.querySelector("main").textContent));

    // ---- confirmación al borrar una sola + duplicar ----
    click(rows()[0]);
    const drawer=()=>d.querySelector(".dc-drawer");
    console.log("El detalle se abre al pulsar la fila:", !!drawer());
    const dup=[...drawer().querySelectorAll("button")].find(b=>/Duplicar/.test(b.textContent));
    console.log("El detalle ofrece 'Duplicar':", !!dup);
    const symBefore=(drawer().textContent.match(/MES|MNQ|CL/)||[""])[0];
    click(dup);
    const modal=d.querySelector("#modal-root");
    const symField=[...modal.querySelectorAll("input")].map(i=>i.value);
    console.log("Duplicar abre el modal precargado con el símbolo:", symField.indexOf(symBefore)>=0, "("+symBefore+")");
    const todayISO=new Date().toISOString().slice(0,10);
    console.log("Duplicar fecha la copia hoy:", symField.indexOf(todayISO)>=0, "("+todayISO+")");
    console.log("Duplicar no deja el detalle abierto:", !d.querySelector(".dc-drawer"));
    // cerrar modal y probar el borrado individual
    click([...modal.querySelectorAll("button")].find(b=>/Cancelar/.test(b.textContent)));
    click(rows()[0]);
    confirms=[];
    click([...d.querySelector(".dc-drawer").querySelectorAll("button")].find(b=>/Eliminar/.test(b.textContent)));
    setTimeout(()=>{try{
      console.log("Borrar una sola pide confirmación nombrándola:", confirms.length===1&&/\$/.test(confirms[0]), "("+(confirms[0]||"").slice(0,60)+")");
      console.log("TRADES HISTORY SMOKE OK");
    }catch(e){console.log("ERR3",e.message,e.stack);}},60);
  }catch(e){console.log("ERR2",e.message,e.stack);}},80);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
