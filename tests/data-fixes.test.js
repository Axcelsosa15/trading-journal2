// Regression tests for three audit fixes:
// 1. Sidebar balance is the real sum of account balances, not a fabricated "Cuenta · Sim" figure.
// 2. Unrecognized futures symbols show a visible warning instead of silently pricing at $1/point.
// 3. CSV export includes MAE/MFE/tags (previously dropped even though every trade stores them).
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
const TRADES=[{id:"t1",date:"2026-06-01",time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5410,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"nota",pnl:50,account_id:null,tags:["breakout","NY"],mae:-5,mfe:12}];
const ACCOUNTS=[{id:"a1",name:"Fondeo A",kind:"fondeo",firm:"",balance:12000,currency:"USD",phase:"",status:"activa",profit_target:"",max_drawdown:"",notes:""},{id:"a2",name:"Live B",kind:"live",firm:"",balance:5000,currency:"USD",phase:"",status:"activa",profit_target:"",max_drawdown:"",notes:""}];
function makeFrom(tbl){const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data; if(tbl==="trades")data=TRADES; else if(tbl==="accounts")data=ACCOUNTS; else if(tbl==="user_settings")data={data:{rules:{},checklist:["x"],onboardingDone:true}}; else data=[];
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
let lastBlob=null;
window.URL.createObjectURL=(blob)=>{lastBlob=blob;return "blob:fake";};
window.URL.revokeObjectURL=()=>{};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  const side=d.querySelector(".side");
  const sideText=side.textContent;
  console.log("Sidebar does not show fabricated 'Cuenta · Sim' label:", !/Cuenta\s*·\s*Sim/.test(sideText));
  console.log("Sidebar shows real balance sum (12,000 + 5,000 = 17,000):", /17,?000|17000/.test(sideText.replace(/\s/g,"")) || /\$17,000/.test(sideText));

  click([...d.querySelectorAll("button")].find(b=>/Nueva operaci/.test(b.textContent)));
  const symbolInput=d.querySelector("#modal-root input[placeholder*='MES']");
  symbolInput.value="ZZZFAKE"; symbolInput.dispatchEvent(new window.Event("input",{bubbles:true}));
  const warnAfterUnknown=d.querySelector("#modal-root").textContent;
  console.log("Unknown futures symbol shows a warning:", /no reconocido/.test(warnAfterUnknown));
  symbolInput.value="YM"; symbolInput.dispatchEvent(new window.Event("input",{bubbles:true}));
  const warnAfterKnown=d.querySelector("#modal-root").textContent;
  console.log("Newly-added symbol (YM) clears the warning:", !/no reconocido/.test(warnAfterKnown));
  click([...d.querySelectorAll("#modal-root button")].find(b=>/Cancelar/.test(b.textContent)));

  click([...d.querySelectorAll(".side button")].find(b=>/Operaciones/.test(b.textContent)));
  const csvBtn=[...d.querySelectorAll("button")].find(b=>/Exportar a CSV/.test(b.getAttribute("title")||""));
  click(csvBtn);
  console.log("CSV export produced a file:", !!lastBlob);
  lastBlob.text().then(function(text){
    var header=text.replace(/^﻿/,"").split(/\r?\n/)[0];
    console.log("CSV header includes MAE:", /MAE/.test(header));
    console.log("CSV header includes MFE:", /MFE/.test(header));
    console.log("CSV header includes Etiquetas:", /Etiquetas/.test(header));
    var row=text.split(/\r?\n/)[1];
    console.log("CSV row carries tag values:", /breakout/.test(row));
    console.log("DATA FIXES SMOKE OK");
  });
}catch(e){console.log("ERR",e.message,e.stack);}},150);
