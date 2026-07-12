// riskStatus() must respect state.scopeAccount like every other dashboard
// metric (scopedTrades()). Before this fix it read state.trades directly, so
// a real daily-loss breach on one account could be masked (or an unrelated
// account's breach falsely shown) once account scoping was in play.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};
function iso(off){const dt=new Date();dt.setDate(dt.getDate()+off);return dt.getFullYear()+"-"+String(dt.getMonth()+1).padStart(2,"0")+"-"+String(dt.getDate()).padStart(2,"0");}
const today=iso(0);
const mk=(id,acc,pnl)=>({id,date:today,time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5405,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl,account_id:acc,tags:[],mae:"",mfe:""});
// acc1 alone breaches the $200 daily-loss rule (-300). acc2 alone is a big
// win (+500). Combined ("all") nets to +200, so the "all" scope never
// breaches — only scoping to acc1 specifically should show the breach.
const TRADES=[mk("l1","acc1",-300),mk("w1","acc2",500)];
const ACCOUNTS=[{id:"acc1",name:"Apex 50K",kind:"fondeo",firm:"Apex",balance:50000,currency:"USD",phase:"",status:"activa",profit_target:null,max_drawdown:null,notes:""},
                {id:"acc2",name:"IBKR Live",kind:"live",firm:"IBKR",balance:10000,currency:"USD",phase:"",status:"activa",profit_target:null,max_drawdown:null,notes:""}];
const SETTINGS={rules:{maxTradesPerDay:0,maxDailyLoss:200,maxWeeklyLoss:0},checklist:["x"],onboardingDone:true};
function makeFrom(tbl){const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data; if(tbl==="trades")data=TRADES; else if(tbl==="accounts")data=ACCOUNTS; else if(tbl==="user_settings")data={data:SETTINGS}; else data=[]; return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
setTimeout(()=>{try{
  const sel=d.querySelector("select.head-scope");
  console.log("Header scope selector present:", !!sel);
  // scope to acc1 (the account that actually breached) -> breach must show
  sel.value="acc1"; sel.dispatchEvent(new window.Event("change",{bubbles:true}));
  const main1=d.querySelector("main").textContent;
  console.log("Scoped to acc1 shows rule breach:", /roto una regla/.test(main1));
  // scope to acc2 (never breached) -> no breach
  sel.value="acc2"; sel.dispatchEvent(new window.Event("change",{bubbles:true}));
  const main2=d.querySelector("main").textContent;
  console.log("Scoped to acc2 shows no breach:", !/roto una regla/.test(main2));
  // scope to all (nets +200, never breaches) -> no breach
  sel.value="all"; sel.dispatchEvent(new window.Event("change",{bubbles:true}));
  const main3=d.querySelector("main").textContent;
  console.log("Scoped to all shows no breach:", !/roto una regla/.test(main3));
  console.log("RISK RULES SCOPE SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},160);
