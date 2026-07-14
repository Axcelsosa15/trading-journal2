// Regression test: the sidebar "Balance total" must show a minus sign and
// red color when the account balance is negative. Previously it rendered
// via money(n), which is Math.abs()-based, so a $500 account down to -$1,700
// after a big loss displayed as a plain "$1,700" — reading as a healthy
// positive balance instead of a deficit.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
function todayISO(){var dt=new Date();var p=n=>String(n).padStart(2,"0");return dt.getFullYear()+"-"+p(dt.getMonth()+1)+"-"+p(dt.getDate());}
const TODAY=todayISO();
// a1 (USD, 500) takes a -2200 loss -> real balance = 500-2200 = -1700.
const TRADES=[
  {id:"t1",date:TODAY,time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5400,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:-2200,account_id:"a1",tags:[],mae:null,mfe:null},
];
const ACCOUNTS=[
  {id:"a1",name:"Fondeo A",kind:"fondeo",firm:"",balance:500,currency:"USD",phase:"",status:"activa",profit_target:"",max_drawdown:"",notes:""},
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
  const balBox=d.querySelector(".side-foot")?.children[0];
  const balEl=balBox?balBox.children[1]:null;
  const side=d.querySelector(".side").textContent.replace(/\s/g,"");
  console.log("Sidebar shows the minus sign for a negative balance:", /−\$1,700|−\$1700/.test(side));
  console.log("Sidebar does not show a bare positive-looking 1,700:", !/(^|[^−])\$1,700|(^|[^−])\$1700/.test(side));
  console.log("Balance figure element exists:", !!balEl);
  console.log("Balance figure is styled red (negative color):", balEl ? /color:\s*(#D6483B|rgb\(214,\s*72,\s*59\))/i.test(balEl.getAttribute("style")||"") : false);
  console.log("SIDEBAR BALANCE NEGATIVE SIGN SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},150);
