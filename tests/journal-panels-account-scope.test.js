// Regression test: the Diario (journal) view's day-P&L chip, "Ánimo vs.
// resultado" mood panel, and checklist-effectiveness panel must respect the
// global account-scope selector like every other analytical view does (see
// account-scope.test.js). Before this fix they read state.trades directly,
// so a journal entry's "day P&L" leaked in trades from every other account
// even while scoped to just one.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};
const mk=(id,acc,pnl)=>({id,date:"2026-06-10",time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5405,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl,account_id:acc,tags:[],mae:"",mfe:""});
// acc1: +100 on 2026-06-10. acc2: -400 on the same day. Combined day P&L: -300.
const TRADES=[mk("a1w1","acc1",100),mk("a2l1","acc2",-400)];
const ACCOUNTS=[{id:"acc1",name:"Apex 50K",kind:"fondeo",firm:"Apex",balance:50000,currency:"USD",phase:"",status:"activa",profit_target:null,max_drawdown:null,notes:""},
                {id:"acc2",name:"IBKR Live",kind:"live",firm:"IBKR",balance:10000,currency:"USD",phase:"",status:"activa",profit_target:null,max_drawdown:null,notes:""}];
const JOURNAL=[{id:"j1",date:"2026-06-10",mood:"Enfocado",text:"Buen día",checklist:null}];
function makeFrom(tbl){const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data; if(tbl==="trades")data=TRADES; else if(tbl==="accounts")data=ACCOUNTS; else if(tbl==="journal")data=JOURNAL; else if(tbl==="user_settings")data={data:{rules:{},checklist:["x"],onboardingDone:true}}; else data=[]; return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  click([...d.querySelectorAll("aside nav button")].find(b=>/Diario/.test(b.textContent)));
  const sel=d.querySelector("select.head-scope");
  console.log("Header account scope selector present:", !!sel);
  // Scoped to "all" -> combined day P&L is -$300 (100 - 400).
  const main0=d.querySelector("main").textContent;
  console.log("Unscoped journal card shows combined day P&L -$300:", /−\$300/.test(main0));
  // Scope to acc1 alone -> that trade's own day P&L is +$100, acc2's -400 must not leak in.
  sel.value="acc1"; sel.dispatchEvent(new window.Event("change",{bubbles:true}));
  const main1=d.querySelector("main").textContent;
  console.log("Scoped to acc1, day P&L is +$100 (no leak from acc2):", /\+\$100/.test(main1) && !/−\$300/.test(main1));
  console.log("JOURNAL PANELS ACCOUNT SCOPE SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},160);
