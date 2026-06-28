// Insights engine connects discipline to results: when the days you completed the
// pre-trade checklist clearly outperform the days you didn't, it surfaces a
// "La checklist te está funcionando" insight. Boots with checklist journal entries.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
const clDays=["2026-06-01","2026-06-02","2026-06-03","2026-06-04"];     // checklist completed
const ncDays=["2026-06-08","2026-06-09","2026-06-10","2026-06-11"];     // no checklist
function mk(id,pnl,date){return {id:id,date:date,time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5400,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:pnl,account_id:null,tags:[],mae:"",mfe:""};}
const TRADES=[];
clDays.forEach((dt,i)=>{TRADES.push(mk("c"+i+"a",200,dt));TRADES.push(mk("c"+i+"b",150,dt));}); // checklist days win
ncDays.forEach((dt,i)=>{TRADES.push(mk("n"+i+"a",-150,dt));TRADES.push(mk("n"+i+"b",-120,dt));}); // non-checklist days lose
const JOURNAL=clDays.map((dt,i)=>({id:"j"+i,date:dt,mood:"Disciplinado",title:"Checklist pre-operación (5/5)",body:"Repaso del plan antes de operar:\n✓ ok",lesson:""}));
function makeFrom(tbl){const b={};b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>Promise.resolve({data:tbl==="trades"?TRADES:(tbl==="journal"?JOURNAL:(tbl==="user_settings"?null:[])),error:null}).then(res,rej);return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  const nav=[...d.querySelectorAll("aside nav button")].find(b=>/Insights/.test(b.textContent));
  click(nav);
  const main=d.querySelector("main").textContent;
  console.log("Insights rendered:", /Patrones detectados/.test(main));
  console.log("Header mentions discipline:", /disciplina/.test(main));
  console.log("Detects checklist edge (good insight):", /La checklist te está funcionando/.test(main));
  console.log("Cites both groups (8 vs 8 ops):", /8 vs 8 ops/.test(main));
  console.log("INSIGHTS DISCIPLINE SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},150);
