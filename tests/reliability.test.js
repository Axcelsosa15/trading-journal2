const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
// 170 trades to exercise the render window (cap 150)
const TRADES=[];for(let i=0;i<170;i++){const day=String((i%27)+1).padStart(2,"0");TRADES.push({id:"t"+i,date:"2026-06-"+day,time:"",symbol:"MES",type:"future",side:i%2?"long":"short",contracts:1,entry:5400,exit:5405,setup:"Ruptura",emotion:"Tranquilo",rating:3,note:"",pnl:i%2?50:-30,account_id:null,tags:[],mae:"",mfe:""});}
function makeFrom(tbl){let op="select";const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>Promise.resolve({data:tbl==="trades"?TRADES:(tbl==="user_settings"?null:[]),error:null}).then(res,rej);
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  const rowCount=()=>[...d.querySelectorAll("main button")].filter(b=>b.style.display==="grid").length;
  console.log("Initial window caps at 150 rows:", rowCount()===150, "("+rowCount()+")");
  const more=[...d.querySelectorAll("main button")].find(b=>/Ver más/.test(b.textContent));
  console.log("'Ver más' button shows remaining:", !!more && /20 restantes/.test(more.textContent));
  click(more);
  console.log("After 'Ver más' all 170 rows render:", rowCount()===170, "("+rowCount()+")");
  console.log("No 'Ver más' once fully shown:", ![...d.querySelectorAll("main button")].some(b=>/Ver más/.test(b.textContent)));
  console.log("RELIABILITY SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},150);
