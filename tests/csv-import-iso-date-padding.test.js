// Regression test: importDate()'s ISO branch (YYYY-MM-DD) rebuilt the date as
// m[1] + "-" + pad(m[2]) + "-" + pad(m[3]), passing the REGEX-CAPTURED STRINGS
// straight into pad(n), which is written for numbers (n < 10 ? "0"+n : ""+n).
// For an already-two-digit capture like "06", the string "06" coerces to 6 in
// the `< 10` comparison (true) but then "0" + "06" concatenates the ORIGINAL
// STRING, producing "006" instead of "06". Every ISO-dated CSV row with a
// zero-padded month or day — i.e. almost any real broker export, and this
// app's own CSV export format — imported with a corrupted date like
// "2026-006-005" instead of "2026-06-05": a value calendar lookups, chronological
// sort, and the date>todayISO() future-date guard all silently mishandle.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
var inserted=[];
function makeFrom(tbl){let op="select",payload=null;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=(r)=>{op="insert";payload=r;return b;};b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data;
   if(op==="insert"){var rows=Array.isArray(payload)?payload:[payload]; if(tbl==="trades") inserted=inserted.concat(rows); data=rows.map((r,i)=>Object.assign({id:"imp"+i},r));}
   else{data=tbl==="user_settings"?null:[];}
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
// Zero-padded ISO date (the app's own CSV export format, and most broker exports).
const CSV=["Fecha,Símbolo,Dirección,Contratos,Entrada,Salida",
  "2026-06-05,MES,Largo,1,5400,5410"].join("\n");
setTimeout(()=>{try{
  click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  click([...d.querySelectorAll("main button")].find(b=>/Importar/.test(b.textContent)));
  const input=d.querySelector("#modal-root input[type=file]");
  const file=new window.File([CSV],"trades.csv",{type:"text/csv"});
  Object.defineProperty(input,"files",{value:[file],configurable:true});
  input.dispatchEvent(new window.Event("change",{bubbles:true}));
  setTimeout(()=>{try{
    const go=[...d.querySelectorAll("#modal-root button")].find(b=>/Importar 1 operaci/.test(b.textContent));
    click(go);
    setTimeout(()=>{try{
      console.log("Exactly one row was inserted:", inserted.length===1);
      console.log("Imported date is the clean ISO string \"2026-06-05\", not double-zero-padded:", inserted[0] && inserted[0].date==="2026-06-05");
      console.log("CSV IMPORT ISO DATE PADDING SMOKE OK");
    }catch(e){console.log("ERR3",e.message,e.stack);}},120);
  }catch(e){console.log("ERR2",e.message,e.stack);}},120);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
