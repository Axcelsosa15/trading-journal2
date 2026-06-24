const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom;
function iso(off){const dt=new Date("2026-06-20T12:00:00");dt.setDate(dt.getDate()+off);return dt.toISOString().slice(0,10);}
const mk=(id,d,side,pnl)=>({id,date:d,time:"10:00",symbol:"MES",type:"future",side,contracts:1,entry:5400,exit:5400+pnl/5,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl,account_id:null,tags:[],mae:"",mfe:""});
const TRADES=[mk("a","2026-04-10","long",200),mk("b","2026-05-12","long",-120),mk("c","2026-05-20","short",90),mk("d","2026-06-05","long",150),mk("e","2026-06-18","short",-60),mk("f","2026-06-19","long",240)];
function makeFrom(tbl){let op="select";const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data; if(op==="select"){data=tbl==="trades"?TRADES:(tbl==="user_settings"?{data:{rules:{},checklist:["x"],onboardingDone:true}}:[]);}else data=null;return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
setTimeout(()=>{try{
  const main=window.document.querySelector("main").textContent;
  const need=["Esperanza en R","Ratio de pago","Drawdown máx.","Racha actual","% días verdes","Mejor día","P&L mensual","Ganadoras vs. perdedoras","Largo vs. corto","win rate","en largo"];
  const missing=need.filter(s=>!main.includes(s));
  console.log("Dashboard sections present:", missing.length===0, missing.length?("MISSING:"+missing):"");
  const svgs=window.document.querySelectorAll("main svg").length;
  console.log("Charts rendered (equity+monthly+2 donuts+setup ≥5):", svgs>=5, "("+svgs+")");
  // donut center shows a win-rate percentage
  console.log("Donut win-rate label:", /%/.test(main));
  console.log("DASHBOARD SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},150);
