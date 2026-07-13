// Two more account-scope leaks: the sidebar "Operaciones" nav badge and the
// dashboard's empty-state gate both read the raw, unscoped state.trades
// instead of scopedTrades(). Scoped to an account with zero trades (while
// another account has trades), the nav badge should show 0 (not the global
// total) and the dashboard should show the "no trades yet" empty card
// (not a KPI grid full of stats computed from an empty scoped set).
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};
const mk=(id,acc,pnl)=>({id,date:"2026-06-1"+(id.length%9),time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5405,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl,account_id:acc,tags:[],mae:"",mfe:""});
// Account A1 has 3 trades; account A2 has none.
const TRADES=[mk("a1w1","acc1",100),mk("a1w2","acc1",100),mk("a1w3","acc1",-50)];
const ACCOUNTS=[{id:"acc1",name:"Apex 50K",kind:"fondeo",firm:"Apex",balance:50000,currency:"USD",phase:"",status:"activa",profit_target:null,max_drawdown:null,notes:""},
                {id:"acc2",name:"IBKR Live",kind:"live",firm:"IBKR",balance:10000,currency:"USD",phase:"",status:"activa",profit_target:null,max_drawdown:null,notes:""}];
function makeFrom(tbl){const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data; if(tbl==="trades")data=TRADES; else if(tbl==="accounts")data=ACCOUNTS; else if(tbl==="user_settings")data={data:{rules:{},checklist:["x"],onboardingDone:true}}; else data=[]; return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
setTimeout(()=>{try{
  const navTrades=()=>[...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent));
  console.log("Unscoped nav badge shows 3:", /Operaciones3\b|Operaciones3$/.test(navTrades().textContent) || navTrades().textContent==="Operaciones3");
  const sel=d.querySelector("select.head-scope");
  console.log("Header account scope selector present:", !!sel);
  // Scope to acc2, which has zero trades.
  sel.value="acc2"; sel.dispatchEvent(new window.Event("change",{bubbles:true}));
  console.log("Nav badge narrows to 0 for empty-scoped account:", navTrades().textContent==="Operaciones0");
  const main=d.querySelector("main").textContent;
  console.log("Dashboard shows empty state for empty-scoped account:", /Aún no tienes operaciones/.test(main));
  console.log("Dashboard does NOT show KPI grid for empty-scoped account:", !/Profit factor/.test(main));
  // Scope back to acc1 (has trades) -> badge and dashboard reflect its 3 trades.
  sel.value="acc1"; sel.dispatchEvent(new window.Event("change",{bubbles:true}));
  console.log("Nav badge back to 3 for acc1:", navTrades().textContent==="Operaciones3");
  console.log("Dashboard shows KPI grid again for acc1:", /Profit factor/.test(d.querySelector("main").textContent));
  console.log("SCOPE LEAK TRADES COUNT SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},160);
