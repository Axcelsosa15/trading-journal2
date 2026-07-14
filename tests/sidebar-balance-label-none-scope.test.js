// Regression test: scoping the header selector to "Sin cuenta" (unassigned
// trades) must not show the "Balance total" label. acctBalanceInfo() filters
// state.accounts by id === state.scopeAccount, which is always empty for the
// "none" sentinel (no account literally has id "none"), so it correctly
// returns total:null and the figure falls back to plain net P&L. But the
// label itself was decided only by state.accounts.length (does the trader
// have ANY accounts at all), not by whether the current scope resolved to
// one — so with a real funded account plus one unassigned trade, scoping to
// "Sin cuenta" showed "Balance total $777", implying that $777 was a real
// funded balance for "no account" when it was just that one trade's raw P&L.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
const TRADES=[
  {id:"t1",date:"2026-06-01",time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5410,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:500,account_id:"a1",tags:[],mae:null,mfe:null},
  {id:"t2",date:"2026-06-02",time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5407.77,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:777,account_id:null,tags:[],mae:null,mfe:null},
];
const ACCOUNTS=[
  {id:"a1",name:"Apex",kind:"fondeo",firm:"",balance:50000,currency:"USD",phase:"",status:"activa",profit_target:"",max_drawdown:"",notes:""},
];
function makeFrom(tbl){const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data; if(tbl==="trades")data=TRADES; else if(tbl==="accounts")data=ACCOUNTS; else if(tbl==="user_settings")data={data:{rules:{},checklist:["x"],onboardingDone:true}}; else data=[];
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
setTimeout(()=>{try{
  const scopeSelect=d.querySelector("select.head-scope");
  console.log("Account scope selector is present:", !!scopeSelect);
  scopeSelect.value="none"; scopeSelect.dispatchEvent(new window.Event("change",{bubbles:true}));
  setTimeout(()=>{try{
    const label=d.querySelector(".side-foot")?.children[0]?.children[0];
    const labelText=label?label.textContent:"";
    console.log("Sidebar label is P&L acumulado, not Balance total:", labelText==="P&L acumulado");
    console.log("SIDEBAR BALANCE LABEL NONE-SCOPE SMOKE OK");
  }catch(e){console.log("ERR2",e.message,e.stack);}},60);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
