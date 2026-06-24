const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x"; window.URL.revokeObjectURL=()=>{};
window.HTMLAnchorElement.prototype.click=function(){};
function iso(off){const dt=new Date();dt.setDate(dt.getDate()+off);return dt.getFullYear()+"-"+String(dt.getMonth()+1).padStart(2,"0")+"-"+String(dt.getDate()).padStart(2,"0");}
const today=iso(0);
// 3 losing trades today to break daily-loss + trade-count rules
const TRADES=[
 {id:"a",date:today,symbol:"MES",type:"future",side:"long",contracts:5,entry:5495,exit:5485,setup:"Ruptura",emotion:"FOMO",rating:2,note:"",pnl:-300,account_id:null,tags:[],mae:"",mfe:""},
 {id:"b",date:today,symbol:"MES",type:"future",side:"long",contracts:5,entry:5495,exit:5490,setup:"Ruptura",emotion:"FOMO",rating:2,note:"",pnl:-250,account_id:null,tags:[],mae:"",mfe:""},
 {id:"c",date:today,symbol:"NQ",type:"future",side:"long",contracts:1,entry:19080,exit:19070,setup:"Pullback",emotion:"Ansioso",rating:3,note:"",pnl:-200,account_id:null,tags:[],mae:"",mfe:""}];
let upserted=null;
const SETTINGS={rules:{maxTradesPerDay:3,maxDailyLoss:500,maxWeeklyLoss:1500},checklist:["¿Está en mi plan?","¿Riesgo definido?"],onboardingDone:false};
function makeFrom(tbl){let op="select",row=null;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=r=>{op="insert";row=r;return b;};b.update=r=>{op="update";row=r;return b;};b.upsert=r=>{op="upsert";row=r;upserted=r;return b;};b.delete=()=>{op="delete";return b;};
 b.then=res=>{let data;
   if(op==="select"){ if(tbl==="trades")data=TRADES; else if(tbl==="user_settings")data={data:SETTINGS}; else data=[]; }
   else if(op==="upsert")data=row;
   else if(op==="insert")data=Object.assign({id:"new",tags:[]},row);
   else data=null;
   return Promise.resolve({data,error:null}).then(res);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>{window.__cb=cb;return{data:{subscription:{unsubscribe(){}}}};},getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  // rules banner present (broke rules)
  const main=d.querySelector("main").textContent;
  console.log("Rules banner:", /roto una regla/.test(main));
  // dashboard risk tracker
  console.log("Risk tracker:", /Control de riesgo/.test(main), "| Regla rota badge:", /Regla rota/.test(main));
  // nav has Ajustes
  console.log("Ajustes nav:", [...d.querySelectorAll("aside nav button")].some(b=>/Ajustes/.test(b.textContent)));
  // open checklist modal
  click([...d.querySelectorAll("header button")].find(b=>/Checklist/.test(b.textContent)));
  let mt=d.getElementById("modal-root").textContent;
  console.log("Checklist modal:", /Checklist antes de operar/.test(mt), "| has questions:", /Está en mi plan/.test(mt));
  // toggle all checklist items -> save enabled
  const boxes=[...d.querySelectorAll("#modal-root button")].filter(b=>/plan|Riesgo/.test(b.textContent));
  boxes.forEach(b=>click(b));
  const ready=[...d.querySelectorAll("#modal-root button")].find(b=>/Todo listo/.test(b.textContent));
  console.log("Checklist ready enabled:", !ready.disabled);
  click(ready);
  // settings view
  click([...d.querySelectorAll("aside nav button")].find(b=>/Ajustes/.test(b.textContent)));
  const sv=d.querySelector("main").textContent;
  console.log("Settings view:", /Reglas de riesgo/.test(sv)&&/Checklist antes de operar/.test(sv));
  const numInputs=[...d.querySelectorAll("main input[type=number]")];
  console.log("Rule inputs:", numInputs.length>=3, "| first value:", numInputs[0].value);
  // edit a rule and save
  numInputs[0].value="5"; numInputs[0].dispatchEvent(new window.Event("input",{bubbles:true}));
  click([...d.querySelectorAll("main button")].find(b=>/Guardar ajustes/.test(b.textContent)));
  setTimeout(()=>{
    console.log("Upserted has user_id+data:", upserted&&upserted.user_id==="u1"&&!!upserted.data);
    console.log("Saved confirmation:", /Ajustes guardados/.test(d.querySelector("main").textContent));
    console.log("TANDA3 SMOKE OK");
  },30);
}catch(e){console.log("ERR",e.message,e.stack);}},120);
