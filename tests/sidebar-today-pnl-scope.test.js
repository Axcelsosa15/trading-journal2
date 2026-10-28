// Regression test: the sidebar's "Hoy" P&L figure (right under "Balance
// total") read raw state.trades instead of scopedTrades(), so it kept
// showing today's P&L across ALL accounts even while the header "Filtrar
// toda la app por cuenta" selector had narrowed every other panel (dashboard,
// risk tracker, equity curve...) to a single account.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};
var now=new Date();
function pad(n){return n<10?"0"+n:""+n;}
var today=now.getFullYear()+"-"+pad(now.getMonth()+1)+"-"+pad(now.getDate());
const mk=(id,acc,pnl)=>({id,date:today,time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5405,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl,account_id:acc,tags:[],mae:"",mfe:""});
// Account A1: +300 today. Account A2: -100 today. Combined +200.
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
  const asideText0=d.querySelector("aside").textContent;
  console.log("Sidebar shows combined today P&L +$200 unscoped:", asideText0.includes("+$200"));
  const sel=d.querySelector("select.head-scope");
  console.log("Header account scope selector present:", !!sel);
  sel.value="acc1"; sel.dispatchEvent(new window.Event("change",{bubbles:true}));
  const asideText1=d.querySelector("aside").textContent;
  console.log("Scoping to Apex narrows sidebar Hoy figure to +$300, not +$200:", asideText1.includes("+$300") && !asideText1.includes("+$200"));
  sel.value="all"; sel.dispatchEvent(new window.Event("change",{bubbles:true}));
  console.log("Back to all restores +$200:", d.querySelector("aside").textContent.includes("+$200"));
  console.log("SIDEBAR TODAY PNL SCOPE SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},160);
