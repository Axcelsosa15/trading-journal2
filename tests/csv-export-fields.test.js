// Regression test: CSV export must include "Sesión" (already computed via
// sessionOf() and used elsewhere in the app) and per-trade "R" multiple, so a
// trader can slice exported data by session or by R without reopening the app.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
// t1: 09:00 UTC (New York AM session per sessionOf), a +100 winner.
// t2: -50 loser -> 1R (avg loss of this set) = 50, so t1's R = 100/50 = 2.00.
const TRADES=[
  {id:"t1",date:"2026-06-01",time:"09:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5420,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:100,account_id:null,tags:[],mae:null,mfe:null},
  {id:"t2",date:"2026-06-02",time:"09:00",symbol:"MES",type:"future",side:"short",contracts:1,entry:5400,exit:5410,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:-50,account_id:null,tags:[],mae:null,mfe:null},
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
  const csvBtn=[...d.querySelectorAll("button")].find(b=>/Exportar a CSV/.test(b.getAttribute("title")||""));
  click(csvBtn);
  console.log("CSV export produced a file:", !!lastBlob);
  lastBlob.text().then(function(text){
    var lines=text.replace(/^﻿/,"").split(/\r?\n/);
    var header=lines[0];
    console.log("CSV header includes Sesión:", /Sesión/.test(header));
    console.log("CSV header includes R:", /(^|,)"?R"?(,|$)/.test(header));
    var body=lines.slice(1).join("\n");
    console.log("Row carries a non-empty session value:", /,Londres,/.test(body));
    console.log("Winner's R multiple is 2.00 (100 pnl / 50 avg-loss unit):", /,100,2\.00,/.test(body));
    console.log("Loser's R multiple is -1.00 (-50 pnl / 50 avg-loss unit):", /,-50,-1\.00,/.test(body));
    console.log("CSV EXPORT FIELDS SMOKE OK");
  });
}catch(e){console.log("ERR",e.message,e.stack);}},150);
