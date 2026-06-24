const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
function run(scenario){
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x"; window.URL.revokeObjectURL=()=>{};
window.HTMLAnchorElement.prototype.click=function(){};
let inserted=null, upserted=null;
const TRADES=scenario.trades;
const SETTINGS=scenario.settings;
function makeFrom(tbl){let op="select",row=null;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=r=>{op="insert";row=r;inserted=r;return b;};b.update=r=>{op="update";row=r;return b;};b.upsert=r=>{op="upsert";row=r;upserted=r;return b;};b.delete=()=>{op="delete";return b;};
 b.then=res=>{let data;
   if(op==="select"){ if(tbl==="trades")data=TRADES; else if(tbl==="user_settings")data=SETTINGS?{data:SETTINGS}:null; else data=[]; }
   else if(op==="upsert")data=row; else if(op==="insert")data=Object.assign({id:"jx",tags:[]},row); else data=null;
   return Promise.resolve({data,error:null}).then(res);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>{return{data:{subscription:{unsubscribe(){}}}};},getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
return new Promise(resolve=>setTimeout(()=>{try{ scenario.run({d,window,click,getInserted:()=>inserted,getUpserted:()=>upserted,resolve}); }catch(e){console.log("ERR",e.message,e.stack);resolve();}},120));
}
(async()=>{
// Scenario A: brand-new user (no trades, onboarding not done) -> onboarding panel
await run({trades:[],settings:null,run:({d,resolve})=>{
  const main=d.querySelector("main").textContent;
  console.log("[A] Onboarding welcome:", /Bienvenido a Bitácora/.test(main));
  console.log("[A] 3 steps:", /Crea tu primera cuenta/.test(main)&&/Registra tu primera operación/.test(main)&&/Define tus reglas de riesgo/.test(main));
  console.log("[A] progress 0 de 3:", /0 de 3/.test(main));
  resolve();
}});
// Scenario B: user with trades + onboardingDone -> no onboarding; journal quick bar works
await run({trades:[{id:"a",date:"2026-06-20",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5410,setup:"Ruptura",emotion:"Tranquilo",rating:3,note:"",pnl:50,account_id:null,tags:[],mae:"",mfe:""}],settings:{rules:{maxTradesPerDay:"",maxDailyLoss:"",maxWeeklyLoss:""},checklist:["x"],onboardingDone:true},
 run:({d,window,click,getInserted,resolve})=>{
  console.log("[B] No onboarding when done:", !/Bienvenido a Bitácora/.test(d.querySelector("main").textContent));
  // go to journal
  click([...d.querySelectorAll("aside nav button")].find(b=>/Diario/.test(b.textContent)));
  const main=d.querySelector("main");
  const input=main.querySelector("input");
  console.log("[B] Quick bar input:", !!input);
  input.value="Día tranquilo, seguí el plan"; input.dispatchEvent(new window.Event("input",{bubbles:true}));
  click([...main.querySelectorAll("button")].find(b=>/Guardar/.test(b.textContent)));
  setTimeout(()=>{
    const ins=getInserted();
    console.log("[B] Quick journal inserted:", ins&&ins.title==="Día tranquilo, seguí el plan"&&ins.mood==="Enfocado");
    console.log("TANDA4 SMOKE OK");
    resolve();
  },30);
}});
})();
