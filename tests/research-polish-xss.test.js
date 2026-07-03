// research-polish.js renders trade-derived labels (parsed from the freeform
// `tags` field) into HTML via insertAdjacentHTML. groupRows() must escape
// them — a tag like "vwap:<img onerror=...>" must render as literal text,
// not become a real DOM element.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
const PAYLOAD="<img src=x onerror=\"window.__xssFired=1\">";
const TRADES=[{id:"a",date:"2026-06-20",time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5420,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:100,account_id:null,tags:["vwap:"+PAYLOAD],mae:"",mfe:""}];
function makeFrom(tbl){let op="select";const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data; if(op==="select"){data=tbl==="trades"?TRADES:(tbl==="user_settings"?null:[]);}else data=null;return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
const ctx=dom.getInternalVMContext();
vm.runInContext(fs.readFileSync("app.js","utf8"),ctx,{filename:"app.js"});
setTimeout(()=>{try{
  vm.runInContext(fs.readFileSync("research-polish.js","utf8"),ctx,{filename:"research-polish.js"});
  var panel=d.querySelector('[data-rp-panel="research"]');
  console.log("Research panel mounted:", !!panel);
  console.log("No <img> element injected from tag data:", !panel || !panel.querySelector("img"));
  console.log("Payload rendered as literal text:", !!panel && panel.textContent.indexOf(PAYLOAD) !== -1);
  console.log("onerror handler never ran:", window.__xssFired !== 1);
  console.log("RESEARCH POLISH XSS SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}
// research-polish.js runs its own setInterval(tick, 2000) that never stops;
// force the test process to exit instead of hanging forever.
process.exit(0);},200);
