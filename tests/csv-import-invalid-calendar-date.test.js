// Regression test: importDate() only bounds-checked month (1-12) and day
// (1-31) independently, so an impossible calendar date (e.g. "31/04/2026",
// April has 30 days) passed validation and reached the DB's `date` column,
// which rejects it — failing the entire bulk insert (including every other
// valid row in the same file) instead of being flagged as a per-row import
// error like other invalid fields.
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
// Row 1 is a real date. Row 2 is "31/04/2026" — April only has 30 days, so
// this must be rejected as invalid rather than silently accepted as-is.
// Row 3 is "29/02/2027" — 2027 is not a leap year, so Feb 29 doesn't exist.
const CSV=["Fecha,Símbolo,Dirección,Contratos,Entrada,Salida",
  "15/03/2026,MES,Largo,1,5400,5410",
  "31/04/2026,NQ,Largo,1,18000,18010",
  "29/02/2027,ES,Largo,1,5000,5010"].join("\n");
setTimeout(()=>{try{
  click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  click([...d.querySelectorAll("main button")].find(b=>/Importar/.test(b.textContent)));
  const input=d.querySelector("#modal-root input[type=file]");
  const file=new window.File([CSV],"trades.csv",{type:"text/csv"});
  Object.defineProperty(input,"files",{value:[file],configurable:true});
  input.dispatchEvent(new window.Event("change",{bubbles:true}));
  setTimeout(()=>{try{
    const text=d.getElementById("modal-root").textContent;
    console.log("Only the one real date is accepted as valid:", /1 operación\(es\) lista\(s\) para importar/.test(text));
    console.log("The two impossible calendar dates are flagged as errors, not silently imported:", /2 fila\(s\) con error/.test(text));
    const go=[...d.querySelectorAll("#modal-root button")].find(b=>/Importar 1 operaci/.test(b.textContent));
    console.log("Import button only offers to import the valid row:", !!go);
    click(go);
    setTimeout(()=>{try{
      click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
      const rows=[...d.querySelectorAll("main button")].filter(b=>b.style.display==="grid");
      console.log("Exactly one trade was inserted (the bad rows didn't poison the whole batch):", rows.length===1);
      console.log("CSV IMPORT INVALID CALENDAR DATE SMOKE OK");
    }catch(e){console.log("ERR3",e.message,e.stack);}},120);
  }catch(e){console.log("ERR2",e.message,e.stack);}},120);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
