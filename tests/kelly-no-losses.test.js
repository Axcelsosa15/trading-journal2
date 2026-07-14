const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};
// Regression: a sample with zero losing trades (avgLoss=0) makes payoff=Infinity.
// The Kelly formula's own limit as payoff (R) -> Infinity is wKelly (win rate),
// since (1-W)/R -> 0 — an all-win sample is Kelly's *best* case, not its worst.
// The old `isFinite(payoff)` guard forced kelly=0 here, showing "Kelly: 0%" for
// a trader who has never lost, the exact opposite of what the math implies.
const TRADES=[
 {id:"a",date:"2026-06-16",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5420,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:100,account_id:null,tags:[],mae:5,mfe:25},
 {id:"b",date:"2026-06-17",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5430,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:150,account_id:null,tags:[],mae:8,mfe:30},
 {id:"c",date:"2026-06-18",symbol:"NQ",type:"future",side:"long",contracts:1,entry:19000,exit:19200,setup:"Ruptura",emotion:"Confiado",rating:5,note:"",pnl:200,account_id:null,tags:[],mae:10,mfe:40}];
function makeFrom(tbl){let op="select",row=null;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=r=>{op="insert";row=r;return b;};b.update=r=>{op="update";row=r;return b;};b.upsert=r=>{op="upsert";row=r;return b;};b.delete=()=>{op="delete";return b;};
 b.then=(res,rej)=>{let data; if(op==="select"){data=tbl==="trades"?TRADES:(tbl==="user_settings"?null:[]);} else data=null; return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
const ctx=dom.getInternalVMContext();
vm.runInContext(fs.readFileSync("app.js","utf8"),ctx,{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  click([...d.querySelectorAll("aside nav button")].find(b=>/Estadísticas/.test(b.textContent)));
  const txt=d.querySelector("main").textContent;
  // 3/3 wins, no losses -> payoff shown as infinite payoff ratio, Kelly should read 100%, not 0%.
  console.log("Payoff shown as infinite (∞):", /∞/.test(txt));
  console.log("Kelly 100% (all wins, not 0%):", /Kelly[\s\S]{0,20}100%/.test(txt));
  console.log("KELLY NO-LOSSES SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},120);
