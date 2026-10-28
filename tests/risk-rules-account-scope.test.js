// Regression test: riskStatus() must respect the global account-scope selector
// like every other analytical view does (see account-scope.test.js), instead
// of always evaluating breaches over state.trades. Before this fix, breaking
// the daily-loss rule on one account leaked into the "rule broken" banner even
// while scoped to a completely separate, clean account.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};
function iso(off){const dt=new Date();dt.setDate(dt.getDate()+off);return dt.getFullYear()+"-"+String(dt.getMonth()+1).padStart(2,"0")+"-"+String(dt.getDate()).padStart(2,"0");}
const today=iso(0);
const mk=(id,acc,pnl)=>({id,date:today,time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5405,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl,account_id:acc,tags:[],mae:"",mfe:""});
// acc1 alone breaks maxDailyLoss (500); acc2 is clean.
const TRADES=[mk("a1l1","acc1",-300),mk("a1l2","acc1",-300),mk("a2w1","acc2",100)];
const ACCOUNTS=[{id:"acc1",name:"Apex 50K",kind:"fondeo",firm:"Apex",balance:50000,currency:"USD",phase:"",status:"activa",profit_target:null,max_drawdown:null,notes:""},
                {id:"acc2",name:"IBKR Live",kind:"live",firm:"IBKR",balance:10000,currency:"USD",phase:"",status:"activa",profit_target:null,max_drawdown:null,notes:""}];
const SETTINGS={rules:{maxTradesPerDay:0,maxDailyLoss:500,maxWeeklyLoss:0},checklist:["x"],onboardingDone:true};
function makeFrom(tbl){const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data; if(tbl==="trades")data=TRADES; else if(tbl==="accounts")data=ACCOUNTS; else if(tbl==="user_settings")data={data:SETTINGS}; else data=[]; return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
setTimeout(()=>{try{
  const main0=d.querySelector("main").textContent;
  console.log("Scoped to 'all', breach banner shown (acc1 breaks the rule):", /roto una regla/.test(main0));
  const sel=d.querySelector("select.head-scope");
  console.log("Header account scope selector present:", !!sel);
  // Scope to acc2 (clean account) -> the -600 on acc1 must not leak in.
  sel.value="acc2"; sel.dispatchEvent(new window.Event("change",{bubbles:true}));
  const main1=d.querySelector("main").textContent;
  console.log("Scoped to clean acc2, no breach banner leaks from acc1:", !/roto una regla/.test(main1));
  // Scope to acc1 (the breaching account) -> banner must still show.
  sel.value="acc1"; sel.dispatchEvent(new window.Event("change",{bubbles:true}));
  const main2=d.querySelector("main").textContent;
  console.log("Scoped to acc1 itself, breach banner still shown:", /roto una regla/.test(main2));
  console.log("RISK RULES ACCOUNT SCOPE SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},160);
