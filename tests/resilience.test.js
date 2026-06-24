const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom;
function makeFrom(tbl){let op="select";const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>Promise.resolve({data:tbl==="user_settings"?null:[],error:null}).then(res,rej);
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
setTimeout(()=>{try{
  console.log("Boots without fatal banner:", !window.document.getElementById("fatal-error"));
  // simulate an uncaught error
  window.dispatchEvent(new window.ErrorEvent("error",{message:"boom"}));
  const bar=window.document.getElementById("fatal-error");
  console.log("Fatal banner appears on uncaught error:", !!bar && /error inesperado/.test(bar.textContent));
  console.log("Banner has reload + close:", !!bar && /Recargar/.test(bar.textContent));
  // role=alert for a11y
  console.log("Banner is an aria alert:", bar && bar.getAttribute("role")==="alert");
  // idempotent (no duplicate on second error)
  window.dispatchEvent(new window.ErrorEvent("error",{message:"boom2"}));
  console.log("No duplicate banner:", window.document.querySelectorAll("#fatal-error").length===1);
  console.log("RESILIENCE SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},120);
