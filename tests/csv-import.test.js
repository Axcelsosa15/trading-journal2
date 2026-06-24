const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
// Supabase mock: trades start empty; insert echoes rows back with ids.
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
const CSV=["Fecha,Símbolo,Dirección,Contratos,Entrada,Salida",
  "2026-06-01,MES,Largo,2,5400,5410",
  "02/06/2026,NQ,Corto,1,18000,17950",
  "2026-06-03,ES,Buy,1,5400,5405",
  ",BADROW,Largo,1,1,2"].join("\n");
setTimeout(()=>{try{
  click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  const importBtn=[...d.querySelectorAll("main button")].find(b=>/Importar/.test(b.textContent));
  console.log("Import button present:", !!importBtn);
  click(importBtn);
  const input=d.querySelector("#modal-root input[type=file]");
  console.log("Import modal + file input:", !!input);
  const file=new window.File([CSV],"trades.csv",{type:"text/csv"});
  Object.defineProperty(input,"files",{value:[file],configurable:true});
  input.dispatchEvent(new window.Event("change",{bubbles:true}));
  setTimeout(()=>{try{
    const mr=d.getElementById("modal-root").textContent;
    console.log("Auto-map preview shows 3 ready:", /3 operaci/.test(mr));
    console.log("Invalid row flagged (1 skipped):", /1 fila\(s\) con error/.test(mr));
    const go=[...d.querySelectorAll("#modal-root button")].find(b=>/Importar 3 operaciones/.test(b.textContent));
    console.log("Import action button shows count:", !!go);
    click(go);
    setTimeout(()=>{try{
      const opsHdr=[...d.querySelectorAll("main span")].map(s=>s.textContent).find(t=>/ops ·/.test(t))||"";
      console.log("3 trades imported:", /^3 ops/.test(opsHdr), "("+opsHdr+")");
      console.log("Modal closed after import:", d.getElementById("modal-root").children.length===0);
      // verify pnl computed for MES long 2 @ +10pts*5 = 100
      const rows=[...d.querySelectorAll("main button")].filter(b=>b.style.display==="grid");
      const hasMES=rows.some(r=>/MES/.test(r.textContent)&&/\$100\b/.test(r.textContent));
      console.log("Computed P&L correct (MES +100):", hasMES);
      console.log("CSV IMPORT SMOKE OK");
    }catch(e){console.log("ERR3",e.message,e.stack);}},120);
  }catch(e){console.log("ERR2",e.message,e.stack);}},120);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
