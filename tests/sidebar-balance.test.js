// Regression test: the sidebar's "Balance total" must reflect current equity
// (starting balance + net realized P&L per account), not just the frozen
// starting balance entered when the account was created. Before this fix, the
// figure never moved after a trade closed — it silently showed a fabricated
// number that diverged from reality with every trade.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
const mk=(id,acc,pnl)=>({id,date:"2026-06-1"+(id.length%9),time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5405,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl,account_id:acc,tags:[],mae:"",mfe:""});
// Account A1: starting $50,000, +$300 realized -> current equity $50,300.
// Account A2: starting $10,000, -$100 realized -> current equity $9,900.
// Combined starting balance ($60,000) is NOT the expected sidebar figure;
// combined current equity ($60,200) is.
const TRADES=[mk("a1w1","acc1",100),mk("a1w2","acc1",100),mk("a1w3","acc1",100),mk("a2l1","acc2",-50),mk("a2l2","acc2",-50)];
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
  const sideText=d.querySelector("aside.side").textContent;
  console.log("Sidebar shows current equity $60,200 (starting + realized P&L):", sideText.includes("$60,200"));
  console.log("Sidebar does NOT show the frozen starting-balance sum $60,000:", !sideText.includes("$60,000"));
  // Accounts view: each card should expose both the starting balance and the
  // current (starting + net) balance, so the two never look inconsistent.
  const navAccounts=[...d.querySelectorAll("aside nav button")].find(b=>/Cuentas/.test(b.textContent));
  navAccounts.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
  const mainText=d.querySelector("main").textContent;
  console.log("Accounts view shows starting balance for Apex ($50,000):", mainText.includes("$50,000"));
  console.log("Accounts view shows current balance for Apex ($50,300):", mainText.includes("$50,300"));
  console.log("Accounts view shows current balance for IBKR ($9,900):", mainText.includes("$9,900"));
  console.log("SIDEBAR BALANCE SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},160);
