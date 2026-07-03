const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
// Pre-seed one existing trade so the CSV import can collide with it.
const EXISTING=[{id:"a",date:"2026-06-01",time:"",symbol:"MES",type:"future",side:"long",contracts:2,entry:5400,exit:5410,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:100,account_id:null,tags:[],mae:"",mfe:""}];
function makeFrom(tbl){let op="select",payload=null;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=(r)=>{op="insert";payload=r;return b;};b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data;
   if(op==="insert"){data=(Array.isArray(payload)?payload:[payload]).map((r,i)=>Object.assign({id:"imp"+i},r));}
   else{data=tbl==="trades"?EXISTING:(tbl==="user_settings"?null:[]);}
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
// Row 1 exactly matches the pre-seeded trade "a" (should be flagged duplicate).
// Rows 2 and 3 are identical to each other (in-file duplicate).
// Row 4 is unique and should import cleanly.
const CSV=["Fecha,Símbolo,Dirección,Contratos,Entrada,Salida",
  "2026-06-01,MES,Largo,2,5400,5410",
  "2026-06-02,MES,Largo,1,5400,5405",
  "2026-06-02,MES,Largo,1,5400,5405",
  "2026-06-03,NQ,Corto,1,18000,17950"].join("\n");
setTimeout(()=>{try{
  click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  const importBtn=[...d.querySelectorAll("main button")].find(b=>/Importar/.test(b.textContent));
  click(importBtn);
  const input=d.querySelector("#modal-root input[type=file]");
  const file=new window.File([CSV],"trades.csv",{type:"text/csv"});
  Object.defineProperty(input,"files",{value:[file],configurable:true});
  input.dispatchEvent(new window.Event("change",{bubbles:true}));
  setTimeout(()=>{try{
    const mr=d.getElementById("modal-root").textContent;
    console.log("Duplicate row (matches existing trade) flagged:", /2 fila\(s\) duplicadas/.test(mr));
    console.log("Only the 2 unique rows are ready to import:", /2 operaci/.test(mr));
    const go=[...d.querySelectorAll("#modal-root button")].find(b=>/Importar 2 operaciones/.test(b.textContent));
    console.log("Import action button shows deduped count:", !!go);
    click(go);
    setTimeout(()=>{try{
      const opsHdr=[...d.querySelectorAll("main span")].map(s=>s.textContent).find(t=>/ops ·/.test(t))||"";
      // 1 pre-seeded + 2 newly imported = 3 total.
      console.log("Total trades after import (1 seeded + 2 new, no dupes):", /^3 ops/.test(opsHdr), "("+opsHdr+")");
      console.log("CSV IMPORT DEDUPE SMOKE OK");
    }catch(e){console.log("ERR3",e.message,e.stack);}},120);
  }catch(e){console.log("ERR2",e.message,e.stack);}},120);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
