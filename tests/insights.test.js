const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
const days=["2026-06-01","2026-06-02","2026-06-03","2026-06-04","2026-06-05","2026-06-08","2026-06-09","2026-06-10"];
function mk(id,setup,emotion,rating,pnl,date){return {id:id,date:date,time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5400,setup:setup,emotion:emotion,rating:rating,note:"",pnl:pnl,account_id:null,tags:[],mae:"",mfe:""};}
const TRADES=[];
for(let i=0;i<8;i++) TRADES.push(mk("w"+i,"Ruptura","Tranquilo",5,200,days[i]));   // strong winners
for(let i=0;i<8;i++) TRADES.push(mk("l"+i,"Reversión","FOMO",1,-150,days[i]));      // FOMO losers
function makeFrom(tbl){const b={};b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>Promise.resolve({data:tbl==="trades"?TRADES:(tbl==="user_settings"?null:[]),error:null}).then(res,rej);return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  const nav=[...d.querySelectorAll("aside nav button")].find(b=>/Insights/.test(b.textContent));
  console.log("Insights nav present:", !!nav);
  click(nav);
  const main=d.querySelector("main").textContent;
  console.log("Header rendered:", /Patrones detectados en tus 16 operaciones/.test(main));
  console.log("Not stuck on 'en construcción':", !/en construcci/.test(main));
  console.log("Detects setup strength (Ruptura):", /fortaleza es Ruptura/.test(main));
  console.log("Detects weak setup (Reversión):", /flojeas en Reversi/.test(main));
  console.log("Detects FOMO emotion weakness:", /estado FOMO/.test(main));
  console.log("Detects conviction calibration:", /lectura de mercado/.test(main));
  // severity counts line present
  console.log("Summary counts present:", /a vigilar ·/.test(main));
  console.log("INSIGHTS SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},150);
