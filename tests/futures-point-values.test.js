// Regression test: FUTURES_PV must recognize M2K, the real CME ticker for the
// Micro E-mini Russell 2000 (the table previously only had "MRTY", which is
// not a tradable symbol — any M2K trade silently fell back to a $1 point
// value and produced a wrong P&L).
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
// M2K long, +10 points, 1 contract: real point value is $5/pt => $50. With the
// old fallback of $1/pt this would compute $10 instead.
const CSV=["Fecha,Símbolo,Dirección,Contratos,Entrada,Salida",
  "2026-06-01,M2K,Largo,1,2000,2010"].join("\n");
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
    console.log("Import ready for the M2K row:", !!go);
    click(go);
    setTimeout(()=>{try{
      const rows=[...d.querySelectorAll("main button")].filter(b=>b.style.display==="grid");
      const hasM2K=rows.some(r=>/M2K/.test(r.textContent)&&/\$50\b/.test(r.textContent));
      console.log("M2K P&L uses the real $5/pt value (+10pts => $50):", hasM2K);
      console.log("FUTURES POINT VALUES SMOKE OK");
    }catch(e){console.log("ERR2",e.message,e.stack);}},120);
  }catch(e){console.log("ERR1",e.message,e.stack);}},120);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
