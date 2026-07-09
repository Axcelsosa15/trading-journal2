// Sidebar "Balance total" must be real equity (starting balance + realized net
// P&L per account), not just the sum of the static balances set when accounts
// were created. That static-only sum diverges from the trader's actual equity
// after every closed trade.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};
const mk=(id,acc,pnl)=>({id,date:"2026-06-10",time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5405,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl,account_id:acc,tags:[],mae:"",mfe:""});
// acc1: balance 50000, trades net +300. acc2: balance 10000, trades net -100.
// Static-only sum would show $60,000; real equity is $60,200.
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
  const side=d.querySelector("aside.side").textContent;
  console.log("Sidebar labels the figure Balance total:", /Balance total/.test(side));
  console.log("Sidebar shows real equity $60,200 (balance + net P&L):", /\$60,200/.test(side));
  console.log("Sidebar does NOT show the stale static-only sum $60,000:", !/\$60,000/.test(side));
  // Scoping the header to one account must not corrupt the sidebar's global total —
  // it should keep reflecting ALL accounts, not just the scoped one.
  const sel=d.querySelector("select.head-scope");
  sel.value="acc1"; sel.dispatchEvent(new window.Event("change",{bubbles:true}));
  const sideScoped=d.querySelector("aside.side").textContent;
  console.log("Sidebar total stays $60,200 even when header is scoped to one account:", /\$60,200/.test(sideScoped));
  console.log("SIDEBAR BALANCE SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},160);
