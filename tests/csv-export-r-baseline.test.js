// Regression test: exportCSV() computed its "1R" baseline from the rows being
// exported (`rUnitOf(rows)`) instead of the full scoped trade set used by
// every other R display in the app (dashboard stat, R distribution chart,
// Estadísticas — all call rUnitOf(scopedTrades())). Filtering the Trades view
// to "Ganadoras" before exporting drops every loss out of that computation,
// so `rUnitOf` fell back to averaging the wins instead of the losses —
// silently rebasing every exported R value to a different, misleading unit
// than the same trades show anywhere else in the app.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
// Full-set 1R = avg loss = 50 (only t3 is a loss). t1's true R = 100/50 = 2.00,
// t2's true R = 200/50 = 4.00. If the export instead rebased on the filtered
// (wins-only) set, 1R would become mean(100,200)=150, giving 0.67 and 1.33.
const TRADES=[
  {id:"t1",date:"2026-06-01",time:"09:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5420,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:100,account_id:null,tags:[],mae:null,mfe:null},
  {id:"t2",date:"2026-06-02",time:"09:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5420,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:200,account_id:null,tags:[],mae:null,mfe:null},
  {id:"t3",date:"2026-06-03",time:"09:00",symbol:"MES",type:"future",side:"short",contracts:1,entry:5400,exit:5410,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:-50,account_id:null,tags:[],mae:null,mfe:null},
];
function makeFrom(tbl){const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data; if(tbl==="trades")data=TRADES; else if(tbl==="user_settings")data={data:{rules:{},checklist:["x"],onboardingDone:true}}; else data=[];
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
  click([...d.querySelectorAll(".side button")].find(b=>/Operaciones/.test(b.textContent)));
  // Filter to wins-only, so the exported `rows` no longer contain t3 (the
  // only loss) — the bug rebased 1R on this filtered subset.
  click([...d.querySelectorAll("main button")].find(b=>b.textContent.trim()==="Ganadoras"));
  const csvBtn=[...d.querySelectorAll("button")].find(b=>/Exportar a CSV/.test(b.getAttribute("title")||""));
  click(csvBtn);
  console.log("CSV export produced a file:", !!lastBlob);
  lastBlob.text().then(function(text){
    var lines=text.replace(/^﻿/,"").split(/\r?\n/);
    var body=lines.slice(1).join("\n");
    console.log("Both winners are in the export (filter applied to trade list, not the R baseline):", lines.length-1===2);
    console.log("t1's R uses the full-set avg-loss baseline (100/50=2.00), not the wins-only mean (100/150=0.67):", /,100,2\.00,/.test(body));
    console.log("t2's R uses the full-set avg-loss baseline (200/50=4.00), not the wins-only mean (200/150=1.33):", /,200,4\.00,/.test(body));
    console.log("CSV EXPORT R BASELINE SMOKE OK");
  });
}catch(e){console.log("ERR",e.message,e.stack);}},150);
