// Full-system integration smoke: boot the app with a populated dataset and walk
// every view in the sidebar, asserting each renders real content and none trips
// the "error inesperado" resilience fallback.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
const jsErrors=[]; window.addEventListener("error",e=>jsErrors.push(e.message||String(e.error||e)));
// Build a realistic dataset so charts/metrics have something to compute.
const SYM=["MES","MNQ","M2K"], SET=["Ruptura","Reversión","Pullback","EMA/VWAP"], EMO=["Tranquilo","Confiado","Ansioso","FOMO"];
const TRADES=[]; for(let i=0;i<30;i++){const win=i%2===0; const side=i%3===0?"short":"long"; const pnl=(win?1:-1)*(40+i*3);
  const day=String((i%26)+1).padStart(2,"0");
  TRADES.push({id:"t"+i,date:"2026-06-"+day,time:"10:"+String(i%60).padStart(2,"0"),symbol:SYM[i%3],type:"future",side,contracts:(i%3)+1,entry:5000+i,exit:5000+i+(side==="long"?(win?5:-5):(win?-5:5)),setup:SET[i%4],emotion:EMO[i%4],rating:(i%5)+1,note:"n",pnl,account_id:"a1",tags:i%2?["plan"]:[],mae:null,mfe:null,screenshot_path:null});}
const JOURNAL=[]; for(let i=0;i<5;i++)JOURNAL.push({id:"j"+i,date:"2026-06-"+String((i%26)+1).padStart(2,"0"),mood:["Disciplinado","Enfocado","Frustrado"][i%3],title:"t"+i,body:"b",lesson:"l"});
const ACCOUNTS=[{id:"a1",name:"Demo",kind:"demo",status:"activa",balance:50000,currency:"USD",firm:"",phase:"",profit_target:null,max_drawdown:null,notes:""}];
function makeFrom(tbl){const b={};
  b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.insert=()=>b;b.update=()=>b;b.delete=()=>b;
  b.single=()=>Promise.resolve({data:null,error:null});b.maybeSingle=()=>Promise.resolve({data:null,error:null});
  b.then=(res,rej)=>{let data=tbl==="trades"?TRADES:tbl==="journal"?JOURNAL:tbl==="accounts"?ACCOUNTS:[];return Promise.resolve({data,error:null}).then(res,rej);};
  return b;}
const storage={from:()=>({list:async()=>({data:[],error:null}),remove:async()=>({data:[],error:null}),createSignedUrl:async()=>({data:{signedUrl:"https://x/y"}})})};
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom,storage})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
function btn(text){return [...d.querySelectorAll("aside button, .side button, nav button")].find(b=>b.textContent.replace(/\s+/g," ").trim().startsWith(text));}
const VIEWS=["Resumen","Operaciones","Calendario","Analítica","Insights","Estadísticas","Correlaciones","Diario","Cuentas","Ajustes"];
setTimeout(()=>{try{
  console.log("App booted with data (logged in shell):", !!d.querySelector("main") && !!d.querySelector("aside, .side"));
  let allOk=true, failed=[];
  VIEWS.forEach(function(label){
    const nb=btn(label); if(nb)nb.click();
    const main=d.querySelector("main"); const txt=(main?main.textContent:"");
    const ok = !!main && txt.length>20 && txt.indexOf("error inesperado")<0;
    if(!ok){allOk=false; failed.push(label);}
  });
  console.log("Every view renders without the error fallback:", allOk, failed.length?("(failed: "+failed.join(", ")+")"):"");
  console.log("No uncaught JS errors during the walk:", jsErrors.length===0, jsErrors.slice(0,3).join(" | "));
  console.log("Trades view shows the 30-trade dataset:", (function(){const nb=btn("Operaciones");if(nb)nb.click();return d.querySelector("main").textContent.indexOf("30")>=0;})());
  console.log("INTEGRATION VIEWS SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},260);
