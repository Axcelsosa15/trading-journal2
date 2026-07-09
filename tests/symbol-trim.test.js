// A manually-typed futures symbol with a stray leading/trailing space (e.g.
// "YM " from typing or pasting) must still resolve its real point value.
// PV()/knownFuturesSymbol() previously only uppercased, not trimmed, so a
// padded symbol silently fell through to the $1/point fallback — understating
// P&L by 5-50x depending on the instrument. It must also be trimmed before
// being stored, so grouping/filtering by symbol elsewhere isn't fragmented.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
let lastInsertPayload=null;
function makeFrom(tbl){let op="select",payload=null,single=false;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>{single=true;return b;};b.maybeSingle=()=>{single=true;return b;};
 b.insert=(r)=>{op="insert";payload=r;if(tbl==="trades")lastInsertPayload=Array.isArray(r)?r[0]:r;return b;};
 b.update=(r)=>{op="update";payload=r;return b;};b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data;
   if(op==="insert"){const withId=Object.assign({id:"new1"},payload);data=single?withId:[withId];}
   else{data=tbl==="user_settings"?null:[];if(single&&Array.isArray(data))data=data[0]||null;}
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
const fireInput=el=>el.dispatchEvent(new window.Event("input",{bubbles:true}));
setTimeout(()=>{try{
  click([...d.querySelectorAll("button")].find(b=>/Nueva operaci/.test(b.textContent)));
  const symbolInput=d.querySelector("#modal-root input[placeholder*='MES']");
  const nums=[...d.querySelectorAll("#modal-root input[type=number]")].filter(i=>i.getAttribute("placeholder")==="0.00");
  const entryInput=nums[0], exitInput=nums[1];
  symbolInput.value="YM "; fireInput(symbolInput);
  entryInput.value="100"; fireInput(entryInput);
  exitInput.value="101"; fireInput(exitInput);
  const preview=d.querySelector("#modal-root").textContent;
  console.log("Trailing-space 'YM ' is still recognized (no unknown-symbol warning):", !/no reconocido/.test(preview));
  console.log("Preview P&L uses YM's real point value (+1pt x $5 = $5), not the $1 fallback:", /\+\$5(?!\d)/.test(preview) && !/\+\$1(?!\d)/.test(preview));
  const saveBtn=[...d.querySelectorAll("#modal-root button")].find(b=>/Guardar operaci/.test(b.textContent));
  click(saveBtn);
  setTimeout(()=>{try{
    console.log("Trade saved:", lastInsertPayload!==null);
    console.log("Stored symbol is trimmed ('YM', not 'YM '):", lastInsertPayload && lastInsertPayload.symbol==="YM");
    console.log("Stored P&L reflects the real point value ($5), not the fallback ($1):", lastInsertPayload && lastInsertPayload.pnl===5);
    console.log("SYMBOL TRIM SMOKE OK");
  }catch(e){console.log("ERR2",e.message,e.stack);}},120);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
