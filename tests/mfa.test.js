const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
function base(mfa){
 const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
 const {window}=dom; const d=window.document;
 window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};window.confirm=()=>true;
 function makeFrom(tbl){let op="select";const b={};
  b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
  b.then=(res,rej)=>{let data; if(op==="select"){data=tbl==="trades"?[]:(tbl==="user_settings"?null:[]);}else data=null;return Promise.resolve({data,error:null}).then(res,rej);};
  return b;}
 let session={user:{email:"t@t.com",id:"u1"}};
 window.supabase={createClient:()=>({auth:Object.assign({onAuthStateChange:f=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},{mfa}),from:makeFrom})};
 vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
 return {d,window};
}
const click=(w,el)=>el.dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
(async()=>{
// Scenario A: login gate
let aal={currentLevel:"aal1",nextLevel:"aal2"};
let verified=true;
const mfaA={
  getAuthenticatorAssuranceLevel:async()=>({data:aal}),
  listFactors:async()=>({data:{totp: verified?[{id:"f1",status:"verified",friendly_name:"Mi app"}]:[]}}),
  challengeAndVerify:async()=>{aal={currentLevel:"aal2",nextLevel:"aal2"};return {data:{},error:null};},
};
const A=base(mfaA);
await new Promise(r=>setTimeout(r,150));
let txt=A.d.getElementById("app").textContent;
console.log("[A] Gate shown:", /Verificación en dos pasos/.test(txt));
const codeInput=A.d.querySelector("#app input");
console.log("[A] Code input present:", !!codeInput);
codeInput.value="123456"; codeInput.dispatchEvent(new A.window.Event("input",{bubbles:true}));
click(A.window,[...A.d.querySelectorAll("#app button")].find(b=>/Verificar/.test(b.textContent)));
await new Promise(r=>setTimeout(r,120));
const after=A.d.getElementById("app").textContent;
console.log("[A] Gate cleared → app shown:", !/Verificación en dos pasos/.test(after) && /Resumen|Operaciones/.test(after));

// Scenario B: enrollment
let factorsB=[];
const mfaB={
  getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:"aal1",nextLevel:"aal1"}}),
  listFactors:async()=>({data:{totp:factorsB}}),
  enroll:async()=>({data:{id:"new1",totp:{qr_code:"data:image/svg+xml;utf8,<svg/>",secret:"ABC123SECRET"}},error:null}),
  challengeAndVerify:async()=>{factorsB=[{id:"new1",status:"verified",friendly_name:"Bitácora"}];return {data:{},error:null};},
  unenroll:async()=>({data:{},error:null}),
};
const B=base(mfaB);
await new Promise(r=>setTimeout(r,150));
console.log("[B] No gate (app shown):", /Resumen|Operaciones/.test(B.d.getElementById("app").textContent));
// go to Ajustes
click(B.window,[...B.d.querySelectorAll("aside nav button")].find(b=>/Ajustes/.test(b.textContent)));
const mfaBtn=[...B.d.querySelectorAll("main button")].find(b=>/Gestionar 2FA/.test(b.textContent));
console.log("[B] 2FA section in Ajustes:", !!mfaBtn);
click(B.window,mfaBtn);
await new Promise(r=>setTimeout(r,80));
let mr=B.d.getElementById("modal-root").textContent;
console.log("[B] Modal opened, no factors msg:", /No tienes 2FA/.test(mr));
click(B.window,[...B.d.querySelectorAll("#modal-root button")].find(b=>/Añadir autenticador/.test(b.textContent)));
await new Promise(r=>setTimeout(r,80));
const qr=B.d.querySelector("#modal-root img");
console.log("[B] QR + secret shown:", !!qr && /ABC123SECRET/.test(B.d.getElementById("modal-root").textContent));
const ci=B.d.querySelector("#modal-root input");
ci.value="654321"; ci.dispatchEvent(new B.window.Event("input",{bubbles:true}));
click(B.window,[...B.d.querySelectorAll("#modal-root button")].find(b=>/Activar 2FA/.test(b.textContent)));
await new Promise(r=>setTimeout(r,80));
console.log("[B] Factor active after verify:", /Autenticadores activos|Verificado/.test(B.d.getElementById("modal-root").textContent));
console.log("MFA SMOKE OK");
})().catch(e=>console.log("ERR",e.message,e.stack));
