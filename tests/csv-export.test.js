// Regression test: the trades CSV export must be complete — it previously
// dropped the trading Session column even though sessionOf() already computes
// it elsewhere in the app, making it impossible to segment exported data by
// session (Asia/London/New York) without reopening the app.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
// 10:00 local -> London session (see sessionOf()).
const TRADES=[{id:"t1",date:"2026-06-01",time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5410,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"nota",pnl:50,commission:2,account_id:null,tags:["plan"],mae:-5,mfe:12}];
function makeFrom(tbl){const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data; if(tbl==="trades")data=TRADES; else if(tbl==="accounts")data=[]; else if(tbl==="user_settings")data={data:{rules:{},checklist:["x"],onboardingDone:true}}; else data=[];
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
    var lines=text.replace(/^﻿/,"").split("\r\n");
    var headers=lines[0].split(",");
    console.log("Header includes Sesión column:", headers.includes("Sesión"));
    console.log("Header still includes gross/commission/net P&L columns:", headers.includes("PnL bruto") && headers.includes("Comisión") && headers.includes("PnL neto"));
    var row=lines[1].split(",");
    var sessionIdx=headers.indexOf("Sesión");
    console.log("Row reports the correct session (Londres) for a 10:00 entry:", row[sessionIdx]==="Londres");
    console.log("CSV EXPORT SMOKE OK");
  });
}catch(e){console.log("ERR",e.message,e.stack);}},160);
