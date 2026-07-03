// A breakeven trade (pnl===0) must end a winning/losing streak the same way
// in both the max-streak and current-streak calculations. Previously the
// max-streak loop silently skipped breakevens (bridging straight through
// them) while the current-streak scan stopped at the first one — two
// contradictory rules for the same concept.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};
// Win, Win, Breakeven, Win, Win, Win (one per day). The breakeven must cut the
// run short: max winning streak is 3 (the trailing run), not 5 (bridging the BE).
const DAYS=["16","17","18","19","20","21"];
const PNLS=[100,100,0,100,100,100];
const TRADES=DAYS.map((day,i)=>({id:"t"+i,date:"2026-06-"+day,time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5400+PNLS[i]/5,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:PNLS[i],account_id:null,tags:[],mae:5,mfe:25}));
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
  const m=main.match(/Racha ganadora máx\.(\d+)/);
  console.log("Max win streak stops at the breakeven (3, not the buggy 5):", !!m && m[1] === "3");
  console.log("STREAK BREAKEVEN SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},150);
