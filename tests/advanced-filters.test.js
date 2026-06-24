const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
const ACCTS=[{id:"a1",name:"Apex",kind:"fondeo",firm:"Apex",balance:50000,currency:"USD",phase:"",status:"activa",profit_target:"",max_drawdown:"",notes:""},
             {id:"a2",name:"Topstep",kind:"fondeo",firm:"Topstep",balance:50000,currency:"USD",phase:"",status:"activa",profit_target:"",max_drawdown:"",notes:""}];
function mk(id,date,pnl,rating,acct){return {id,date,time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5400+pnl/5,setup:"Ruptura",emotion:"Tranquilo",rating,note:"",pnl,account_id:acct,tags:[],mae:"",mfe:"",screenshot_path:null};}
const TRADES=[mk("t1","2026-06-01",100,5,"a1"),mk("t2","2026-06-05",-50,2,"a1"),mk("t3","2026-06-10",200,4,"a2"),mk("t4","2026-06-15",-30,3,"a2"),mk("t5","2026-06-20",60,5,null),mk("t6","2026-06-25",40,1,"a1")];
function makeFrom(tbl){const b={};b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data=tbl==="trades"?TRADES.slice():(tbl==="accounts"?ACCTS.slice():(tbl==="user_settings"?null:[]));return Promise.resolve({data,error:null}).then(res,rej);};return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
const rowCount=()=>[...d.querySelectorAll("main button")].filter(b=>b.style.display==="grid").length;
const goTrades=()=>click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
setTimeout(()=>{try{
  goTrades();
  console.log("All 6 trades shown initially:", rowCount()===6, "("+rowCount()+")");
  // date-from filter
  const dates=[...d.querySelectorAll("main input[type=date]")];
  dates[0].value="2026-06-10"; dates[0].dispatchEvent(new window.Event("change",{bubbles:true}));
  console.log("Date-from >= 2026-06-10 keeps 4:", rowCount()===4, "("+rowCount()+")");
  // clear
  let clear=[...d.querySelectorAll("main button")].find(b=>/Limpiar filtros/.test(b.textContent));
  console.log("Active-filter chip + clear shown:", !!clear && /filtro activo/.test(d.querySelector("main").textContent));
  click(clear);
  console.log("Cleared back to 6:", rowCount()===6);
  // pnl min filter
  const nums=[...d.querySelectorAll("main input[type=number]")];
  nums[0].value="50"; nums[0].dispatchEvent(new window.Event("change",{bubbles:true}));
  console.log("P&L >= 50 keeps 3:", rowCount()===3, "("+rowCount()+")");
  click([...d.querySelectorAll("main button")].find(b=>/Limpiar filtros/.test(b.textContent)));
  // per-account: Ver operaciones
  click([...d.querySelectorAll("aside nav button")].find(b=>/Cuentas/.test(b.textContent)));
  const verBtns=[...d.querySelectorAll("main button")].filter(b=>/Ver operaciones/.test(b.textContent));
  console.log("Per-account 'Ver operaciones' present (2):", verBtns.length===2);
  click(verBtns[0]); // Apex = a1 -> t1,t2,t6
  console.log("Jumped to trades filtered by account (a1 -> 3 rows):", rowCount()===3, "("+rowCount()+")");
  console.log("ADVANCED FILTERS SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},150);
