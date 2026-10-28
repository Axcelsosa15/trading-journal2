// Regression test: CSV import must not silently drop Etiquetas/MAE/MFE columns.
// exportCSV() writes them (see csv-export-fields.test.js); until this fix,
// IMPORT_FIELDS had no mapping for them and buildImportRow() hard-coded
// tags:[], mae:null, mfe:null for every imported row — a re-import of the
// app's own export lost that data silently.
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
// Mirrors exportCSV()'s own column order/format: MAE, MFE numeric, tags space-joined.
const CSV=["Fecha,Símbolo,Dirección,Contratos,Entrada,Salida,MAE,MFE,Etiquetas",
  "2026-06-01,MES,Largo,2,5400,5410,3.5,12,FOMO breakout"].join("\n");
setTimeout(()=>{try{
  click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  const importBtn=[...d.querySelectorAll("main button")].find(b=>/Importar/.test(b.textContent));
  click(importBtn);
  const input=d.querySelector("#modal-root input[type=file]");
  const file=new window.File([CSV],"trades.csv",{type:"text/csv"});
  Object.defineProperty(input,"files",{value:[file],configurable:true});
  input.dispatchEvent(new window.Event("change",{bubbles:true}));
  setTimeout(()=>{try{
    const go=[...d.querySelectorAll("#modal-root button")].find(b=>/Importar 1 operaci/.test(b.textContent));
    console.log("Import action button found:", !!go);
    click(go);
    setTimeout(()=>{try{
      const row=[...d.querySelectorAll("main button")].find(b=>b.style.display==="grid"&&/MES/.test(b.textContent));
      console.log("Imported row present:", !!row);
      click(row);
      setTimeout(()=>{try{
        const detail=d.body.textContent;
        console.log("Imported MAE value shown (3.5):", /MAE3\.5/.test(detail));
        console.log("Imported MFE value shown (12):", /MFE12/.test(detail));
        console.log("Imported tag FOMO shown:", /FOMO/.test(detail));
        console.log("Imported tag breakout shown:", /breakout/.test(detail));
        console.log("CSV IMPORT FIELDS SMOKE OK");
      }catch(e){console.log("ERR4",e.message,e.stack);}},120);
    }catch(e){console.log("ERR3",e.message,e.stack);}},120);
  }catch(e){console.log("ERR2",e.message,e.stack);}},120);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
