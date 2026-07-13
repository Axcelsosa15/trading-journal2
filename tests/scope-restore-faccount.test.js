// Regression test: a persisted account scope (localStorage bitacora_scope_account)
// must also align the Operaciones list's own account filter (state.fAccount) on
// page load — mirrors what setScopeAccount() already does when the trader picks an
// account live (see account-scope.test.js). Before this fix, restoreScopeAccount()
// only set state.scopeAccount, leaving state.fAccount at its default "all", so a
// reload with a saved scope showed the header narrowed to one account while
// Operaciones kept listing every account's trades.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};
window.localStorage.setItem("bitacora_scope_account","acc1"); // simulate a returning user
const mk=(id,acc,pnl)=>({id,date:"2026-06-10",time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5405,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl,account_id:acc,tags:[],mae:"",mfe:""});
const TRADES=[mk("a1w1","acc1",100),mk("a2l1","acc2",-400)];
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
  console.log("Header scope selector restored to acc1:", sel && sel.value==="acc1");
  click([...d.querySelectorAll(".side button")].find(b=>/Operaciones/.test(b.textContent)));
  const acctSelect=[...d.querySelectorAll("main select")].find(s=>/Todas las cuentas/.test(s.textContent) && /Apex 50K/.test(s.textContent));
  console.log("Operaciones account filter present:", !!acctSelect);
  console.log("Operaciones account filter restored to acc1, not 'Todas las cuentas':", acctSelect && acctSelect.value==="acc1");
  const main=d.querySelector("main").textContent;
  console.log("Only acc1's trade is listed (acc2's -$400 does not leak in):", /\+\$100/.test(main) && !/−\$400/.test(main));
  console.log("SCOPE RESTORE FACCOUNT SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},160);
