const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
function makeFrom(tbl){const b={};b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>Promise.resolve({data:tbl==="user_settings"?null:[],error:null}).then(res,rej);return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  // Settings: EMA 10/20 scalping card + load checklist
  click([...d.querySelectorAll("aside nav button")].find(b=>/Ajustes/.test(b.textContent)));
  const main=d.querySelector("main").textContent;
  console.log("EMA 10/20 strategy card present:", /Sistema Scalping · EMA 10\/20/.test(main));
  const ta1=d.querySelector("main textarea");
  console.log("Strategy checklist not yet loaded:", !/ventana horaria de scalping/.test(ta1.value));
  const loadBtn=[...d.querySelectorAll("main button")].find(b=>/Añadir checklist de scalping EMA 10\/20/.test(b.textContent));
  console.log("Load-checklist button present:", !!loadBtn);
  click(loadBtn);
  const ta2=d.querySelector("main textarea");
  console.log("Checklist now includes EMA 10/20 checks:", /ventana horaria de scalping/.test(ta2.value)&&/Cruce EMA10\/EMA20/.test(ta2.value));
  // idempotent: clicking again doesn't duplicate
  const before=(ta2.value.match(/ventana horaria de scalping/g)||[]).length;
  click([...d.querySelectorAll("main button")].find(b=>/Añadir checklist de scalping EMA 10\/20/.test(b.textContent)));
  const after=(d.querySelector("main textarea").value.match(/ventana horaria de scalping/g)||[]).length;
  console.log("Load is idempotent (no duplicates):", before===1&&after===1);
  // Add modal: EMA 10/20 Scalping available as a Setup
  click([...d.querySelectorAll("button")].find(b=>/Nueva operaci/.test(b.textContent)));
  const opts=[...d.querySelectorAll("#modal-root select option")].map(o=>o.value);
  console.log("EMA 10/20 Scalping available as a Setup:", opts.indexOf("EMA 10/20 Scalping")>=0);
  console.log("EMA1020 STRATEGY SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},150);
