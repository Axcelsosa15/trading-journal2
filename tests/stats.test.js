const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};
// Known dataset to validate math:
// pnls: +100,+100,-50,-50,+200  (over distinct days)
const TRADES=[
 {id:"a",date:"2026-06-16",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5420,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:100,account_id:null,tags:[],mae:5,mfe:25},
 {id:"b",date:"2026-06-17",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5420,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:100,account_id:null,tags:[],mae:8,mfe:30},
 {id:"c",date:"2026-06-18",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5390,setup:"Pullback",emotion:"Ansioso",rating:2,note:"",pnl:-50,account_id:null,tags:[],mae:20,mfe:5},
 {id:"e",date:"2026-06-19",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5390,setup:"Pullback",emotion:"FOMO",rating:2,note:"",pnl:-50,account_id:null,tags:[],mae:18,mfe:3},
 {id:"f",date:"2026-06-20",symbol:"NQ",type:"future",side:"long",contracts:1,entry:19000,exit:19200,setup:"Ruptura",emotion:"Confiado",rating:5,note:"",pnl:200,account_id:null,tags:[],mae:10,mfe:40}];
function makeFrom(tbl){let op="select",row=null;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=r=>{op="insert";row=r;return b;};b.update=r=>{op="update";row=r;return b;};b.upsert=r=>{op="upsert";row=r;return b;};b.delete=()=>{op="delete";return b;};
 b.then=(res,rej)=>{let data; if(op==="select"){data=tbl==="trades"?TRADES:(tbl==="user_settings"?null:[]);} else data=null; return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
const ctx=dom.getInternalVMContext();
vm.runInContext(fs.readFileSync("app.js","utf8"),ctx,{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  // navigate to stats
  click([...d.querySelectorAll("aside nav button")].find(b=>/Estadísticas/.test(b.textContent)));
  const txt=d.querySelector("main").textContent;
  const need=["Rentabilidad","Profit factor","Expectativa en R","SQN","Sharpe","Sortino","Kelly","Drawdown máximo","Racha ganadora","Mediana","Distribución de P&L","Curva de drawdown","Edge ratio"];
  const missing=need.filter(s=>!txt.includes(s));
  console.log("Stats sections present:", missing.length===0, missing.length?("MISSING:"+missing):"");
  // numeric sanity: PF should be 400/100 = 4.00 ; net +300 ; winrate 60%
  console.log("PF 4.00 shown:", /4\.00/.test(txt), "| net +$300:", /\+\$300/.test(txt), "| 60% WR:", /60%/.test(txt));
  // histogram + drawdown svg present
  console.log("SVGs rendered:", d.querySelectorAll("main svg").length>=2);
  // per-trade R in detail drawer: open first trade
  click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  const rowBtns=[...d.querySelectorAll("main button")].filter(b=>b.style.display==="grid");
  click(rowBtns[0]);
  const drawer=d.body.textContent;
  console.log("Detail shows R-multiple + 1R:", /R · 1R =/.test(drawer));
  console.log("STATS SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},120);
