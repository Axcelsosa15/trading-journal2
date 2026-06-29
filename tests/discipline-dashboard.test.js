// Dashboard discipline panel: shows the share of traded days on which the
// pre-trade checklist was completed, plus the current consecutive streak.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
const days=["2026-06-15","2026-06-16","2026-06-17","2026-06-18","2026-06-19"]; // 5 traded days
const mk=(id,dt,pnl)=>({id,date:dt,time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5400+pnl/5,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl,account_id:null,tags:[],mae:"",mfe:""});
const TRADES=days.map((dt,i)=>mk("t"+i,dt,(i%2?-60:120)));
// Checklist completed on the 3 most recent traded days -> 3/5 = 60%, streak 3.
const clDays=["2026-06-17","2026-06-18","2026-06-19"];
const JOURNAL=clDays.map((dt,i)=>({id:"j"+i,date:dt,mood:"Disciplinado",title:"Checklist pre-operación (5/5)",body:"Repaso del plan antes de operar:\n✓ ok",lesson:""}));
function makeFrom(tbl){const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>Promise.resolve({data:tbl==="trades"?TRADES:(tbl==="journal"?JOURNAL:(tbl==="user_settings"?null:[])),error:null}).then(res,rej);return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
setTimeout(()=>{try{
  const main=d.querySelector("main").textContent;
  console.log("Discipline panel present:", main.includes("Disciplina · checklist"));
  console.log("Adherence rate shown (60%):", main.includes("60%"));
  console.log("Adhered/total days shown (3/5):", main.includes("3/5 días"));
  console.log("Current streak shown (3 días seguidos):", /Racha actual: 3 días seguidos/.test(main));
  console.log("Good-habit badge:", main.includes("Buen hábito"));
  console.log("DISCIPLINE DASHBOARD SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},150);
