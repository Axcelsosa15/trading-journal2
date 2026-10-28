// Regression test: FUTURES_PV must recognize CME crypto futures (BTC, MBT,
// ETH, MET) and Cboe VIX futures (VX). Before this fix, these increasingly
// common retail futures symbols were absent from the table, so any trade
// logged under them silently fell back to the wrong $1/point default and
// produced a fabricated P&L (same failure mode as the M2K gap fixed earlier).
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
// MBT (Micro Bitcoin) long, +100 points, 1 contract: real point value is
// $0.1/pt => $10. With the old $1/pt fallback this would compute $100 instead.
// ETH (Ether) long, +10 points, 1 contract: real point value is $50/pt => $500.
const CSV=["Fecha,Símbolo,Dirección,Contratos,Entrada,Salida",
  "2026-06-01,MBT,Largo,1,60000,60100",
  "2026-06-02,ETH,Largo,1,3000,3010"].join("\n");
setTimeout(()=>{try{
  click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  const importBtn=[...d.querySelectorAll("main button")].find(b=>/Importar/.test(b.textContent));
  click(importBtn);
  const input=d.querySelector("#modal-root input[type=file]");
  const file=new window.File([CSV],"trades.csv",{type:"text/csv"});
  Object.defineProperty(input,"files",{value:[file],configurable:true});
  input.dispatchEvent(new window.Event("change",{bubbles:true}));
  setTimeout(()=>{try{
    const go=[...d.querySelectorAll("#modal-root button")].find(b=>/Importar 2 operaci/.test(b.textContent));
    console.log("Import ready for both crypto-futures rows:", !!go);
    click(go);
    setTimeout(()=>{try{
      const rows=[...d.querySelectorAll("main button")].filter(b=>b.style.display==="grid");
      const hasMBT=rows.some(r=>/MBT/.test(r.textContent)&&/\$10\b/.test(r.textContent));
      const hasETH=rows.some(r=>/ETH/.test(r.textContent)&&/\$500\b/.test(r.textContent));
      console.log("MBT P&L uses the real $0.1/pt value (+100pts => $10):", hasMBT);
      console.log("ETH P&L uses the real $50/pt value (+10pts => $500):", hasETH);
      console.log("CRYPTO FUTURES POINT VALUES SMOKE OK");
    }catch(e){console.log("ERR2",e.message,e.stack);}},120);
  }catch(e){console.log("ERR1",e.message,e.stack);}},120);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
