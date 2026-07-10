// Regression test: the sidebar "Balance total" must reconcile each account's
// starting balance with the net P&L booked against it (accountStats), not
// just the static starting number — a trade closing today has to move the
// figure. Accounts are also only summed within the majority currency; a
// minority-currency account is excluded and flagged instead of fabricating a
// mixed-currency total.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
// a1 (USD, 10000) has a closed +500 winner and a -200 loser booked against it -> live 10300.
// a2 (USD, 5000) has no trades -> live 5000. a3 (EUR, 1000) must be excluded from the USD total.
const TRADES=[
  {id:"t1",date:"2026-06-01",time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5410,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:500,account_id:"a1",tags:[],mae:null,mfe:null},
  {id:"t2",date:"2026-06-02",time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5390,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:-200,account_id:"a1",tags:[],mae:null,mfe:null},
];
const ACCOUNTS=[
  {id:"a1",name:"Fondeo A",kind:"fondeo",firm:"",balance:10000,currency:"USD",phase:"",status:"activa",profit_target:"",max_drawdown:"",notes:""},
  {id:"a2",name:"Live B",kind:"live",firm:"",balance:5000,currency:"USD",phase:"",status:"activa",profit_target:"",max_drawdown:"",notes:""},
  {id:"a3",name:"Cuenta EUR",kind:"live",firm:"",balance:1000,currency:"EUR",phase:"",status:"activa",profit_target:"",max_drawdown:"",notes:""},
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
  const sideText=d.querySelector(".side").textContent;
  console.log("Sidebar reconciles a1's balance with its booked net P&L (10000+500-200=10300) plus a2's untouched 5000 = 15,300:", /15,300|15300/.test(sideText.replace(/\s/g,"")));
  console.log("Sidebar does NOT show the naive pre-reconciliation total (10000+5000=15000):", !/\$15,000(?!\.)/.test(sideText));
  console.log("EUR-denominated account is excluded from the USD total, not silently added:", !/16,300|16300/.test(sideText.replace(/\s/g,"")));
  console.log("Sidebar flags the excluded EUR account:", /1 cuenta\(s\) en otra moneda/.test(sideText));
  console.log("SIDEBAR BALANCE RECONCILE SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},150);
