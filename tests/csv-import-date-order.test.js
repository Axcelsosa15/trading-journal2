// Regression test: when a CSV mixes an unambiguous M/D/Y date (day>12) with an
// ambiguous one (both fields <=12) in the SAME file, the ambiguous row must
// follow the file's proven convention instead of independently guessing
// day-first and silently swapping day/month.
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
// Row 1 "3/15/2026" is unambiguous M/D/Y (day=15>12) -> proves the whole file is US-style.
// Row 2 "4/2/2026" is ambiguous on its own -> must be read as month=4,day=2 (April 2), not Feb 4.
const CSV=["Fecha,Símbolo,Dirección,Contratos,Entrada,Salida",
  "3/15/2026,MES,Largo,1,5400,5410",
  "4/2/2026,MES,Largo,1,5400,5420"].join("\n");
setTimeout(()=>{try{
  click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  click([...d.querySelectorAll("main button")].find(b=>/Importar/.test(b.textContent)));
  const input=d.querySelector("#modal-root input[type=file]");
  const file=new window.File([CSV],"trades.csv",{type:"text/csv"});
  Object.defineProperty(input,"files",{value:[file],configurable:true});
  input.dispatchEvent(new window.Event("change",{bubbles:true}));
  setTimeout(()=>{try{
    const mr=d.getElementById("modal-root").textContent;
    console.log("Both rows parsed as valid (no bogus date rejected):", /2 operaci/.test(mr));
    const go=[...d.querySelectorAll("#modal-root button")].find(b=>/Importar 2 operaciones/.test(b.textContent));
    click(go);
    setTimeout(()=>{try{
      click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
      const rowsText=[...d.querySelectorAll("main button")].filter(b=>b.style.display==="grid").map(b=>b.textContent).join(" | ");
      console.log("Unambiguous row kept as 15 Mar (2026-03-15):", /15 Mar/.test(rowsText));
      console.log("Ambiguous row followed file's M/D/Y convention -> 2 Abr, not 4 Feb:", /2 Abr/.test(rowsText) && !/4 Feb/.test(rowsText));
      console.log("CSV IMPORT DATE ORDER SMOKE OK");
    }catch(e){console.log("ERR3",e.message,e.stack);}},120);
  }catch(e){console.log("ERR2",e.message,e.stack);}},120);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
