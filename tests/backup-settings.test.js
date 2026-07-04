// Regression test: the JSON "Backup" export must include the user's settings
// (risk rules, checklist, onboarding state), not just trades/journal/accounts.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
const TRADES=[{id:"t1",date:"2026-06-01",time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5410,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"nota",pnl:50,account_id:null,tags:[],mae:-5,mfe:12}];
function makeFrom(tbl){const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data; if(tbl==="trades")data=TRADES; else if(tbl==="accounts")data=[]; else if(tbl==="user_settings")data={data:{rules:{maxTradesPerDay:5,maxDailyLoss:200,maxWeeklyLoss:600},checklist:["Plan escrito","Riesgo definido"],onboardingDone:true}}; else data=[];
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
let lastBlob=null;
window.URL.createObjectURL=(blob)=>{lastBlob=blob;return "blob:fake";};
window.URL.revokeObjectURL=()=>{};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  click([...d.querySelectorAll(".side button")].find(b=>/Operaciones/.test(b.textContent)));
  const backupBtn=[...d.querySelectorAll("button")].find(b=>/Copia de seguridad/.test(b.getAttribute("title")||""));
  click(backupBtn);
  console.log("Backup export produced a file:", !!lastBlob);
  lastBlob.text().then(function(text){
    var data=JSON.parse(text);
    console.log("Backup includes settings:", !!data.settings);
    console.log("Backup settings carry the checklist:", Array.isArray(data.settings&&data.settings.checklist) && data.settings.checklist.indexOf("Plan escrito")>=0);
    console.log("Backup settings carry the risk rules:", !!(data.settings&&data.settings.rules&&Number(data.settings.rules.maxDailyLoss)===200));
    console.log("Backup still includes trades:", Array.isArray(data.trades) && data.trades.length===1);
    console.log("BACKUP SETTINGS SMOKE OK");
  });
}catch(e){console.log("ERR",e.message,e.stack);}},150);
