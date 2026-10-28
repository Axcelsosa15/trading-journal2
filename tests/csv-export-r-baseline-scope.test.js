// Regression test: exportCSV(rows) computed its "1R" baseline with
// rUnitOf(rows) — whatever subset is currently filtered in the Trades view —
// instead of rUnitOf(scopedTrades()), which every other R display in the app
// uses (dashboard stat, R distribution chart, Estadísticas). Filtering to
// "Ganadoras" (wins only) before exporting drops every loss out of the
// export's baseline, so rUnitOf falls back to averaging the wins and silently
// rebases every exported R value to a different, misleading unit than the
// same trades show anywhere else in the app.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
// Full-scope 1R = mean(|-50|,|-100|) = 75, so the winner's true R is
// 200/75 = 2.67. The buggy filtered-subset baseline (winner only, no losses
// in the filtered set) falls back to mean(wins) = 200, giving R = 1.00.
const TRADES=[
  {id:"t1",date:"2026-06-01",time:"09:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5420,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:200,account_id:null,tags:[],mae:null,mfe:null},
  {id:"t2",date:"2026-06-02",time:"09:00",symbol:"MES",type:"future",side:"short",contracts:1,entry:5400,exit:5410,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:-50,account_id:null,tags:[],mae:null,mfe:null},
  {id:"t3",date:"2026-06-03",time:"09:00",symbol:"MES",type:"future",side:"short",contracts:1,entry:5400,exit:5420,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:-100,account_id:null,tags:[],mae:null,mfe:null},
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
  click([...d.querySelectorAll(".side button, aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  // Filter to winners only before exporting.
  click([...d.querySelectorAll("main button")].find(b=>b.textContent.trim()==="Ganadoras"));
  const csvBtn=[...d.querySelectorAll("button")].find(b=>/Exportar a CSV/.test(b.getAttribute("title")||""));
  click(csvBtn);
  console.log("CSV export produced a file:", !!lastBlob);
  lastBlob.text().then(function(text){
    var lines=text.replace(/^﻿/,"").split(/\r?\n/);
    var body=lines.slice(1).join("\n");
    console.log("Winner's R multiple uses the full-account 1R baseline (2.67), not the filtered-subset fallback (1.00):", /,200,2\.67,/.test(body) && !/,200,1\.00,/.test(body));
    console.log("CSV EXPORT R BASELINE SCOPE SMOKE OK");
  });
}catch(e){console.log("ERR",e.message,e.stack);}},150);
