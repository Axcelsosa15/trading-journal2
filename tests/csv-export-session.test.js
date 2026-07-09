// CSV export must include a "Sesión" (Asia/Londres/Nueva York) column so
// exported trades can be segmented by session — sessionOf() already exists
// and is used elsewhere (insights, stats) but was missing from the export.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
let lastBlob=null;
window.URL.createObjectURL=(blob)=>{lastBlob=blob;return "blob:fake";};
window.URL.revokeObjectURL=()=>{};
const mk=(id,time,pnl)=>({id,date:"2026-06-10",time,symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5405,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl,account_id:null,tags:[],mae:"",mfe:"",commission:0});
// 09:00 -> Londres, 15:00 -> Nueva York, 02:00 -> Asia
const TRADES=[mk("t1","09:00",100),mk("t2","15:00",100),mk("t3","02:00",100)];
function makeFrom(tbl){const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data; if(tbl==="trades")data=TRADES; else if(tbl==="user_settings")data={data:{rules:{},checklist:["x"],onboardingDone:true}}; else data=[]; return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  const csvBtn=[...d.querySelectorAll("main button")].find(b=>/^CSV$/.test(b.textContent.trim()));
  console.log("CSV export button present:", !!csvBtn);
  click(csvBtn);
  console.log("Export produced a file:", !!lastBlob);
  lastBlob.text().then(function(text){
    const lines=text.replace(/^﻿/,"").split("\r\n");
    const headers=lines[0].split(",");
    console.log("Header row includes Sesión column:", headers.includes("Sesión"));
    const sessionIdx=headers.indexOf("Sesión");
    const dataLines=lines.slice(1,4);
    console.log("09:00 trade tagged Londres:", dataLines.some(l=>l.split(",")[sessionIdx]==="Londres"));
    console.log("15:00 trade tagged Nueva York:", dataLines.some(l=>l.split(",")[sessionIdx]==="Nueva York"));
    console.log("02:00 trade tagged Asia:", dataLines.some(l=>l.split(",")[sessionIdx]==="Asia"));
    console.log("CSV EXPORT SESSION SMOKE OK");
  }).catch(e=>console.log("ERR2",e.message));
}catch(e){console.log("ERR",e.message,e.stack);}},160);
