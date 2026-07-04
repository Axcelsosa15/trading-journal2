// Global account scope: picking an account in the header narrows the WHOLE app
// (dashboard metrics), not just the trades list. Boots with two accounts and
// verifies the dashboard net P&L changes when scoped.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};
const mk=(id,acc,pnl)=>({id,date:"2026-06-1"+(id.length%9),time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5405,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl,account_id:acc,tags:[],mae:"",mfe:""});
// Account A1: +300 (all wins). Account A2: -100. Combined +200.
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
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  const main0=d.querySelector("main").textContent;
  console.log("Dashboard shows combined net +$200:", main0.includes("+$200"));
  // header scope selector present with both accounts
  const sel=d.querySelector("select.head-scope");
  console.log("Header account scope selector present:", !!sel);
  console.log("Scope options include both accounts:", sel && /Apex 50K/.test(sel.textContent) && /IBKR Live/.test(sel.textContent) && /Todas las cuentas/.test(sel.textContent));
  // scope to Apex (acc1) -> dashboard should now show +$300, not +$200
  sel.value="acc1"; sel.dispatchEvent(new window.Event("change",{bubbles:true}));
  const main1=d.querySelector("main").textContent;
  console.log("Scoping to Apex narrows dashboard to +$300:", main1.includes("+$300") && !main1.includes("+$200"));
  console.log("Scope persisted to localStorage:", window.localStorage.getItem("bitacora_scope_account")==="acc1");
  // scope back to all -> +$200 again
  sel.value="all"; sel.dispatchEvent(new window.Event("change",{bubbles:true}));
  console.log("Back to all restores +$200:", d.querySelector("main").textContent.includes("+$200"));
  console.log("ACCOUNT SCOPE SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},160);
