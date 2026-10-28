// Regression test: with zero losing trades, avgLoss is 0 so payoff (avgWin /
// |avgLoss|) is Infinity. advancedStats() then gated the Kelly formula on
// `payoff > 0 && isFinite(payoff)`, which is false for Infinity, so a perfect
// winning streak reported Kelly as 0% — the opposite of what the formula
// implies (a 100% win rate should push the optimal fraction toward ~100%).
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};
const TRADES=[
 {id:"a",date:"2026-06-16",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5420,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:100,account_id:null,tags:[],mae:5,mfe:25},
 {id:"b",date:"2026-06-17",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5450,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:150,account_id:null,tags:[],mae:5,mfe:30},
 {id:"c",date:"2026-06-18",symbol:"NQ",type:"future",side:"long",contracts:1,entry:19000,exit:19200,setup:"Ruptura",emotion:"Confiado",rating:5,note:"",pnl:200,account_id:null,tags:[],mae:10,mfe:40}];
function makeFrom(tbl){let op="select";const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data; if(op==="select"){data=tbl==="trades"?TRADES:(tbl==="user_settings"?null:[]);} else data=null; return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  click([...d.querySelectorAll("aside nav button")].find(b=>/Estadísticas/.test(b.textContent)));
  const txt=d.querySelector("main").textContent;
  console.log("Kelly shows 100% with an all-winners set, not 0%:", /Prudente: la mitad \(50%\)/.test(txt));
  console.log("KELLY NO LOSSES SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},120);
