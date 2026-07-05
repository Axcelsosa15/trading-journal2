// Regression test: CSV export must be complete enough to reconstruct session
// classification and R-multiple performance without reopening the app —
// these were silently missing even after the commission/PnL columns were added.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
const TRADES=[
  {id:"t1",date:"2026-06-01",time:"14:30",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5430,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:150,commission:0,account_id:null,tags:[],mae:"",mfe:""},
  {id:"t2",date:"2026-06-02",time:"09:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5375,setup:"Ruptura",emotion:"Ansioso",rating:2,note:"",pnl:-75,commission:0,account_id:null,tags:[],mae:"",mfe:""}
];
function makeFrom(tbl){const b={};b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data=tbl==="trades"?TRADES.slice():(tbl==="user_settings"?null:[]);return Promise.resolve({data,error:null}).then(res,rej);};return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
let lastBlob=null;
window.URL.createObjectURL=(blob)=>{lastBlob=blob;return "blob:fake";};
window.URL.revokeObjectURL=()=>{};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  click([...d.querySelectorAll(".side button")].find(b=>/Operaciones/.test(b.textContent)));
  const exportBtn=[...d.querySelectorAll("button")].find(b=>/Exportar a CSV las operaciones/.test(b.getAttribute("title")||""));
  console.log("Export CSV button present:", !!exportBtn);
  click(exportBtn);
  console.log("Export produced a file:", !!lastBlob);
  lastBlob.text().then(function(text){
    var lines=text.replace(/^﻿/,"").split("\r\n").filter(Boolean);
    var headers=lines[0].split(",");
    console.log("Headers include Sesión:", headers.indexOf("Sesión")>=0);
    console.log("Headers include R:", headers.indexOf("R")>=0);
    var sIdx=headers.indexOf("Sesión"), rIdx=headers.indexOf("R");
    // Trades view lists newest-first, so row 1 is 2026-06-02 (09:00 UTC, the loss)
    // and row 2 is 2026-06-01 (14:30 UTC, the win).
    var row1=lines[1].split(","), row2=lines[2].split(",");
    console.log("Row 1 session is Londres (09:00 UTC):", row1[sIdx]==="Londres");
    console.log("Row 2 session is Nueva York (14:30 UTC):", row2[sIdx]==="Nueva York");
    // 1R = avg loss = 75. Loss -75 -> R=-1.00; win +150 -> R=2.00.
    console.log("Row 1 R multiple is -1.00:", row1[rIdx]==="-1.00");
    console.log("Row 2 R multiple is 2.00:", row2[rIdx]==="2.00");
    console.log("CSV EXPORT FIELDS SMOKE OK");
  });
}catch(e){console.log("ERR",e.message,e.stack);}},150);
