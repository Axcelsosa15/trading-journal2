// Regression test: buildImportRow() validated CSV dates for calendar
// correctness (validDate()) but never checked them against today, unlike the
// manual Add-Trade form (isSaveValid()/saveTrade() reject date > todayISO()).
// A CSV row with a typo'd future year (e.g. "2027" instead of "2026") slipped
// straight past importPreview() and into `trades`, corrupting the calendar
// view and the dashboard's "current month" bucket — the exact same bad input
// the manual form already blocks.
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
// Row 1 is dated today. Row 2 is 7 days in the future — must be rejected the
// same way the manual entry form rejects a future date.
const today=new Date();
const futureDate=new Date(Date.now()+7*86400000);
function iso(dt){return dt.getFullYear()+"-"+String(dt.getMonth()+1).padStart(2,"0")+"-"+String(dt.getDate()).padStart(2,"0");}
const CSV=["Fecha,Símbolo,Dirección,Contratos,Entrada,Salida",
  iso(today)+",MES,Largo,1,5400,5410",
  iso(futureDate)+",NQ,Largo,1,18000,18010"].join("\n");
setTimeout(()=>{try{
  click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  click([...d.querySelectorAll("main button")].find(b=>/Importar/.test(b.textContent)));
  const input=d.querySelector("#modal-root input[type=file]");
  const file=new window.File([CSV],"trades.csv",{type:"text/csv"});
  Object.defineProperty(input,"files",{value:[file],configurable:true});
  input.dispatchEvent(new window.Event("change",{bubbles:true}));
  setTimeout(()=>{try{
    const text=d.getElementById("modal-root").textContent;
    console.log("Only today's date is accepted as valid:", /1 operación\(es\) lista\(s\) para importar/.test(text));
    console.log("The future-dated row is flagged as an error, not silently imported:", /1 fila\(s\) con error/.test(text));
    const go=[...d.querySelectorAll("#modal-root button")].find(b=>/Importar 1 operaci/.test(b.textContent));
    console.log("Import button only offers to import the valid row:", !!go);
    click(go);
    setTimeout(()=>{try{
      click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
      const rows=[...d.querySelectorAll("main button")].filter(b=>b.style.display==="grid");
      console.log("Exactly one trade was inserted (the future-dated row didn't get in):", rows.length===1);
      console.log("CSV IMPORT FUTURE DATE SMOKE OK");
    }catch(e){console.log("ERR3",e.message,e.stack);}},120);
  }catch(e){console.log("ERR2",e.message,e.stack);}},120);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
