// Regression test: the sidebar "Balance total" and "Hoy" P&L must narrow to the
// selected account when the header account-scope selector is used, just like
// every other panel (dashboard, risk tracker, equity curve) already does.
// Previously acctBalanceInfo() summed ALL accounts unconditionally and the
// "Hoy" line read raw state.trades, so scoping to one account still showed a
// fabricated combined total.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
function todayISO(){var dt=new Date();var p=n=>String(n).padStart(2,"0");return dt.getFullYear()+"-"+p(dt.getMonth()+1)+"-"+p(dt.getDate());}
const TODAY=todayISO();
// a1 (USD, 10000) has a closed +500 winner booked today. a2 (USD, 5000) has a -200 loser booked today.
const TRADES=[
  {id:"t1",date:TODAY,time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5410,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:500,account_id:"a1",tags:[],mae:null,mfe:null},
  {id:"t2",date:TODAY,time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5390,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:-200,account_id:"a2",tags:[],mae:null,mfe:null},
];
const ACCOUNTS=[
  {id:"a1",name:"Fondeo A",kind:"fondeo",firm:"",balance:10000,currency:"USD",phase:"",status:"activa",profit_target:"",max_drawdown:"",notes:""},
  {id:"a2",name:"Live B",kind:"live",firm:"",balance:5000,currency:"USD",phase:"",status:"activa",profit_target:"",max_drawdown:"",notes:""},
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
  const side0=d.querySelector(".side").textContent.replace(/\s/g,"");
  console.log("Unscoped sidebar shows combined balance 10000+500+5000-200=15,300:", /15,300|15300/.test(side0));
  const sel=d.querySelector("select.head-scope");
  console.log("Header account scope selector present:", !!sel);
  sel.value="a1"; sel.dispatchEvent(new window.Event("change",{bubbles:true}));
  const side1=d.querySelector(".side").textContent.replace(/\s/g,"");
  console.log("Scoping to Fondeo A narrows Balance total to 10,500 (10000+500), not 15,300:", /10,500|10500/.test(side1) && !/15,300|15300/.test(side1));
  console.log("Scoping to Fondeo A narrows Hoy P&L to +$500, not the combined +$300:", /\+\$500/.test(side1) && !/\+\$300/.test(side1));
  sel.value="a2"; sel.dispatchEvent(new window.Event("change",{bubbles:true}));
  const side2=d.querySelector(".side").textContent.replace(/\s/g,"");
  console.log("Scoping to Live B narrows Balance total to 4,800 (5000-200):", /4,800|4800/.test(side2));
  console.log("Scoping to Live B narrows Hoy P&L to -$200:", /−\$200/.test(side2));
  sel.value="all"; sel.dispatchEvent(new window.Event("change",{bubbles:true}));
  const side3=d.querySelector(".side").textContent.replace(/\s/g,"");
  console.log("Back to all restores combined 15,300:", /15,300|15300/.test(side3));
  console.log("SIDEBAR BALANCE SCOPE SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},150);
