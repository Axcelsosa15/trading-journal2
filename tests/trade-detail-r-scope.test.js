// Regression test: the R-multiple badge in the trade-detail drawer must use
// the same 1R baseline (average loss of the *scoped* trade set) as every
// other place R is computed — see advancedStats()/rUnitOf() callers at
// app.js:2672/2690, which all pass scopedTrades(). Before this fix the
// drawer passed the unscoped state.trades, so the same trade could show a
// different R-multiple in the drawer than in Stats/Analytics.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};
const mk=(id,acc,sym,date,pnl)=>({id,date,time:"10:00",symbol:sym,type:"future",side:"long",contracts:1,entry:5400,exit:5400+pnl,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl,account_id:acc,tags:[],mae:"",mfe:""});
// acc1: two -100 losses. acc2: one -500 loss and one +200 win (the trade under test).
// Scoped to acc2, 1R = avg loss of acc2 = 500 -> R = 200/500 = +0.40R.
// Unscoped (bug), 1R = avg loss of ALL trades = mean(100,100,500) = 233.33 -> R = +0.86R.
const TRADES=[mk("a1l1","acc1","MES","2026-06-01",-100),mk("a1l2","acc1","MES","2026-06-02",-100),
              mk("a2l1","acc2","MGC","2026-06-03",-500),mk("a2w1","acc2","MNQ","2026-06-04",200)];
const ACCOUNTS=[{id:"acc1",name:"Apex 50K",kind:"fondeo",firm:"Apex",balance:50000,currency:"USD",phase:"",status:"activa",profit_target:null,max_drawdown:null,notes:""},
                {id:"acc2",name:"IBKR Live",kind:"live",firm:"IBKR",balance:10000,currency:"USD",phase:"",status:"activa",profit_target:null,max_drawdown:null,notes:""}];
function makeFrom(tbl){const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data; if(tbl==="trades")data=TRADES; else if(tbl==="accounts")data=ACCOUNTS; else if(tbl==="user_settings")data={data:{rules:{},checklist:["x"],onboardingDone:true}}; else data=[]; return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  const sel=d.querySelector("select.head-scope");
  console.log("Header account scope selector present:", !!sel);
  sel.value="acc2"; sel.dispatchEvent(new window.Event("change",{bubbles:true}));
  const row=[...d.querySelectorAll("main button")].find(b=>b.style.display==="grid"&&/MNQ/.test(b.textContent));
  console.log("Recent-trades row for the scoped win (MNQ) found:", !!row);
  click(row);
  const detail=d.body.textContent;
  console.log("Detail drawer shows scoped R +0.40R:", /\+0\.40R/.test(detail));
  console.log("Detail drawer does NOT show unscoped R +0.86R:", !/\+0\.86R/.test(detail));
  console.log("TRADE DETAIL R SCOPE SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},160);
