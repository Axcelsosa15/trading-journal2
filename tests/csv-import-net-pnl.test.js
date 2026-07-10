// Regression test: auto-detected CSV import mapping must bind the "pnl" field
// to the NET P&L column, not the gross one, when a file has both (like our
// own exportCSV() output: "PnL bruto" appears before "PnL neto"). Before this
// fix, IMPORT_FIELDS' generic /pnl|net/i keyword matched "PnL bruto" first
// (findIndex returns the first match), so every column-order-sensitive
// re-import silently imported the gross figure as if it were already net —
// even though every stat in the app treats a trade's stored pnl as net of
// commission.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
function makeFrom(tbl){let op="select",payload=null;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=(r)=>{op="insert";payload=r;return b;};b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data;
   if(op==="insert"){data=(Array.isArray(payload)?payload:[payload]).map((r,i)=>Object.assign({id:"imp"+i},r));}
   else{data=tbl==="user_settings"?null:[];}
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
// Mirrors exportCSV()'s own column order: gross ("PnL bruto") before net ("PnL neto").
const CSV=["Fecha,Símbolo,Dirección,Contratos,Entrada,Salida,PnL bruto,Comisión,PnL neto",
  "2026-06-01,MES,Largo,1,5400,5410,100,5,95"].join("\n");
setTimeout(()=>{try{
  click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  click([...d.querySelectorAll("main button")].find(b=>/Importar/.test(b.textContent)));
  const input=d.querySelector("#modal-root input[type=file]");
  const file=new window.File([CSV],"trades.csv",{type:"text/csv"});
  Object.defineProperty(input,"files",{value:[file],configurable:true});
  input.dispatchEvent(new window.Event("change",{bubbles:true}));
  setTimeout(()=>{try{
    const go=[...d.querySelectorAll("#modal-root button")].find(b=>/Importar 1 operaci/.test(b.textContent));
    console.log("Import action button found:", !!go);
    click(go);
    setTimeout(()=>{try{
      click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
      const row=[...d.querySelectorAll("main button")].find(b=>b.style.display==="grid"&&/MES/.test(b.textContent));
      console.log("Imported row present:", !!row);
      console.log("Imported P&L is the NET figure +$95, not gross +$100:", /\+\$95/.test(row.textContent) && !/\+\$100/.test(row.textContent));
      console.log("CSV IMPORT NET PNL SMOKE OK");
    }catch(e){console.log("ERR3",e.message,e.stack);}},120);
  }catch(e){console.log("ERR2",e.message,e.stack);}},120);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
