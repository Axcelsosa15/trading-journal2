// Streaks/drawdown/equity must follow the ACTUAL intraday sequence of trades,
// not the order they happen to arrive from the server (date desc, created_at
// desc). Two trades logged on the same day, entered out of order, must still
// be scored by their `time` field. Also: a breakeven trade must end a streak
// consistently in both the max-streak and current-streak calculations.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};
// Server order (date desc, created_at desc): the 14:00 win on 06-20 was
// created after the 09:00 loss on the same day, so it's listed first even
// though it happened later in the day.
const TRADES=[
 {id:"a",date:"2026-06-20",time:"14:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5420,setup:"Ruptura",emotion:"Confiado",rating:4,note:"",pnl:100,account_id:null,tags:[],mae:5,mfe:25},
 {id:"b",date:"2026-06-20",time:"09:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5390,setup:"Pullback",emotion:"Ansioso",rating:2,note:"",pnl:-50,account_id:null,tags:[],mae:15,mfe:5},
 {id:"c",date:"2026-06-19",time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5420,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:100,account_id:null,tags:[],mae:5,mfe:25}];
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
  const main=d.querySelector("main").textContent;
  // Chronologically (using `time`): win(06-19), loss(06-20 09:00), win(06-20 14:00).
  // The most recent trade is a win, so current streak must be +1, not -1.
  console.log("Current streak follows intraday time order (+1, not -1):", /Racha actual[\s\S]{0,40}\+1/.test(main));
  console.log("Current streak is not the buggy -1:", !/Racha actual[\s\S]{0,40}[^+]-1\D/.test(main));
  console.log("CHRONO ORDER STREAKS SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},150);
