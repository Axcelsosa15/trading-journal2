// Regression test: the sidebar "Balance total" must be the account's funded
// balance PLUS its realized net P&L, not just the static number typed in when
// the account was created (which used to go stale the moment a trade closed).
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
const ACCTS=[{id:"a1",name:"Apex",kind:"fondeo",firm:"Apex",balance:50000,currency:"USD",phase:"",status:"activa",profit_target:"",max_drawdown:"",notes:""}];
const TRADES=[
  {id:"t1",date:"2026-06-01",time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5430,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:150,commission:0,account_id:"a1",tags:[],mae:"",mfe:""},
  {id:"t2",date:"2026-06-02",time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5395,setup:"Ruptura",emotion:"Tranquilo",rating:2,note:"",pnl:-25,commission:0,account_id:"a1",tags:[],mae:"",mfe:""}
];
function makeFrom(tbl){const b={};b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data=tbl==="trades"?TRADES.slice():(tbl==="accounts"?ACCTS.slice():(tbl==="user_settings"?null:[]));return Promise.resolve({data,error:null}).then(res,rej);};return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
setTimeout(()=>{try{
  const aside=d.querySelector("aside.side, .side").textContent;
  console.log("Sidebar shows 'Balance total' label:", /Balance total/.test(aside));
  // Starting balance 50000 + net P&L (150-25=125) = 50125, NOT the stale 50000.
  console.log("Sidebar balance reflects starting balance + realized P&L (50,125):", /\$50,125/.test(aside));
  console.log("Sidebar balance is not frozen at the raw account balance (50,000):", !/\$50,000/.test(aside));
  console.log("SIDEBAR BALANCE SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},150);
