// Regression test: importDate() decided day-first vs. month-first per row in
// isolation. An unambiguous row (e.g. "3/15/2026", day=15 proves M/D/Y) proves
// the file's real convention, but an ambiguous row later in the *same* file
// (e.g. "4/2/2026") must follow that same convention instead of silently
// defaulting to day-first on its own (which would turn April 2 into Feb 4).
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
// Row 1 is unambiguous M/D/Y (day=15 > 12): proves the file is month-first.
// Row 2 ("4/2/2026") is genuinely ambiguous on its own — must follow row 1's
// proven month-first convention and land on April 2, not February 4.
const CSV=["Fecha,Símbolo,Dirección,Contratos,Entrada,Salida",
  "3/15/2026,MES,Largo,1,5400,5410",
  "4/2/2026,NQ,Largo,1,18000,18010"].join("\n");
setTimeout(()=>{try{
  click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  click([...d.querySelectorAll("main button")].find(b=>/Importar/.test(b.textContent)));
  const input=d.querySelector("#modal-root input[type=file]");
  const file=new window.File([CSV],"trades.csv",{type:"text/csv"});
  Object.defineProperty(input,"files",{value:[file],configurable:true});
  input.dispatchEvent(new window.Event("change",{bubbles:true}));
  setTimeout(()=>{try{
    const go=[...d.querySelectorAll("#modal-root button")].find(b=>/Importar 2 operaciones/.test(b.textContent));
    console.log("Both rows accepted as valid:", !!go);
    click(go);
    setTimeout(()=>{try{
      const rows=[...d.querySelectorAll("main button")].filter(b=>b.style.display==="grid");
      console.log("Ambiguous row follows the file's proven month-first convention (2 Abr, not 4 Feb):", rows.some(r=>/2 Abr/i.test(r.textContent)) && !rows.some(r=>/4 Feb/i.test(r.textContent)));
      console.log("Unambiguous row still reads March 15 correctly:", rows.some(r=>/15 Mar/i.test(r.textContent)));
      console.log("CSV IMPORT DATE ORDER SMOKE OK");
    }catch(e){console.log("ERR3",e.message,e.stack);}},120);
  }catch(e){console.log("ERR2",e.message,e.stack);}},120);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
