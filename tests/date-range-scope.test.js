// Regression test: the header's date-range badge (dateRangeLabel()) must respect
// the global account-scope selector like every other analytical view does (see
// account-scope.test.js). Before this fix it read state.trades directly, so
// scoping to one account still showed the combined date range of every account,
// right next to the "Filtrar toda la app por cuenta" selector.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};
const mk=(id,acc,date,pnl)=>({id,date,time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5405,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl,account_id:acc,tags:[],mae:"",mfe:""});
// acc1 trades span Jan-Feb; acc2's lone trade is in December, much later.
const TRADES=[mk("a1w1","acc1","2026-01-05",100),mk("a1w2","acc1","2026-02-10",100),mk("a2w1","acc2","2026-12-20",50)];
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
  const header0=d.querySelector("header").textContent;
  console.log("Unscoped header shows the full Jan-Dec range (Dic):", /Dic/.test(header0));
  const sel=d.querySelector("select.head-scope");
  console.log("Header account scope selector present:", !!sel);
  // Scope to acc1 alone -> the range badge should shrink to Jan-Feb and drop acc2's December trade.
  sel.value="acc1"; sel.dispatchEvent(new window.Event("change",{bubbles:true}));
  const header1=d.querySelector("header").textContent;
  console.log("Scoped to acc1, range no longer shows December (no leak from acc2):", !/Dic/.test(header1));
  console.log("Scoped to acc1, range still shows Enero/Febrero:", /Ene/.test(header1) && /Feb/.test(header1));
  console.log("DATE RANGE SCOPE SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},160);
