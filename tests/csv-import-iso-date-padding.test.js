// Regression test: importDate()'s ISO branch passed the regex-matched month
// and day *strings* straight into pad(), which does `n < 10` (numeric
// comparison, but the operand is still a string) and then string-concatenates
// the result — so pad("07") returned "007" instead of "07". A CSV date that's
// already zero-padded ISO (e.g. "2026-07-05", the common shape for most
// broker exports) was silently stored as "2026-007-05". fmtDate() happens to
// still *display* it correctly (Number("007") === 7), which is why this
// slipped past casual testing, but the corrupted three-digit string breaks
// every string-based date comparison in the app: date-range filters
// (t.date >= state.fDateFrom), the calendar view's day lookup, and
// chronological sort order.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
let inserted=null;
function makeFrom(tbl){let op="select",payload=null;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=(r)=>{op="insert";payload=r;return b;};b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data;
   if(op==="insert"){data=(Array.isArray(payload)?payload:[payload]).map((r,i)=>Object.assign({id:"imp"+i},r)); if(tbl==="trades") inserted=data;}
   else{data=tbl==="user_settings"?null:[];}
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
// Already zero-padded ISO date, the common broker-export shape.
const CSV=["Fecha,Símbolo,Dirección,Contratos,Entrada,Salida",
  "2026-07-05,MES,Largo,1,5400,5410"].join("\n");
setTimeout(()=>{try{
  click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  click([...d.querySelectorAll("main button")].find(b=>/Importar/.test(b.textContent)));
  const input=d.querySelector("#modal-root input[type=file]");
  const file=new window.File([CSV],"trades.csv",{type:"text/csv"});
  Object.defineProperty(input,"files",{value:[file],configurable:true});
  input.dispatchEvent(new window.Event("change",{bubbles:true}));
  setTimeout(()=>{try{
    const go=[...d.querySelectorAll("#modal-root button")].find(b=>/Importar 1 operaci/.test(b.textContent));
    console.log("Import ready for the zero-padded ISO row:", !!go);
    click(go);
    setTimeout(()=>{try{
      console.log("Stored date keeps a two-digit month (2026-07-05, not corrupted to 2026-007-05):", !!inserted && inserted[0].date === "2026-07-05");
      console.log("CSV IMPORT ISO DATE PADDING SMOKE OK");
    }catch(e){console.log("ERR2",e.message,e.stack);}},120);
  }catch(e){console.log("ERR",e.message,e.stack);}},120);
}catch(e){console.log("ERR3",e.message,e.stack);}},150);
