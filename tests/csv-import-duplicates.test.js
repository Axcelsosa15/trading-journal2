const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
// Supabase mock: trades persist across inserts within this run (unlike the
// plain csv-import test) so a second import of the same rows can be checked
// against what's already "in the DB".
let trades=[];
function makeFrom(tbl){let op="select",payload=null;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=(r)=>{op="insert";payload=r;return b;};b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data;
   if(tbl==="trades"&&op==="select"){data=trades;}
   else if(op==="insert"){
     data=(Array.isArray(payload)?payload:[payload]).map((r,i)=>Object.assign({id:"imp"+trades.length+"_"+i},r));
     if(tbl==="trades") trades=trades.concat(data);
   }
   else{data=tbl==="user_settings"?null:[];}
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
const CSV=["Fecha,Símbolo,Dirección,Contratos,Entrada,Salida",
  "2026-06-01,MES,Largo,2,5400,5410",
  "2026-06-02,NQ,Corto,1,18000,17950"].join("\n");

function openImportAndUpload(cb){
  click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  const importBtn=[...d.querySelectorAll("main button")].find(b=>/Importar/.test(b.textContent));
  click(importBtn);
  const input=d.querySelector("#modal-root input[type=file]");
  const file=new window.File([CSV],"trades.csv",{type:"text/csv"});
  Object.defineProperty(input,"files",{value:[file],configurable:true});
  input.dispatchEvent(new window.Event("change",{bubbles:true}));
  setTimeout(cb,120);
}

setTimeout(()=>{try{
  // First import: nothing on file yet, so no duplicate warning expected.
  openImportAndUpload(()=>{try{
    const mr1=d.getElementById("modal-root").textContent;
    console.log("First import shows 2 ready:", /2 operaci/.test(mr1));
    console.log("First import has no duplicate warning:", !/parecen duplicadas/.test(mr1));
    const go=[...d.querySelectorAll("#modal-root button")].find(b=>/Importar 2 operaciones/.test(b.textContent));
    click(go);
    setTimeout(()=>{try{
      console.log("First import inserted into mock DB:", trades.length===2);
      // Second import of the identical CSV: every row now matches an existing trade.
      openImportAndUpload(()=>{try{
        const mr2=d.getElementById("modal-root").textContent;
        console.log("Second import still shows 2 ready:", /2 operaci/.test(mr2));
        console.log("Second import flags both as duplicates:", /2 fila\(s\) parecen duplicadas/.test(mr2));
        console.log("CSV IMPORT DUPLICATES SMOKE OK");
      }catch(e){console.log("ERR3",e.message,e.stack);}});
    }catch(e){console.log("ERR2",e.message,e.stack);}},120);
  }catch(e){console.log("ERR1",e.message,e.stack);}});
}catch(e){console.log("ERR",e.message,e.stack);}},150);
