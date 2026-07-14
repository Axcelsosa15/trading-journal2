// Regression test: isSaveValid() (which drives the Guardar button's
// enabled/disabled styling) checked the raw Number(d.contracts) > 0, while
// saveTrade() itself rounds first (Math.round(Number(d.contracts))) before
// the same check. For a value like "0.4", isSaveValid() said true (button
// looked fully enabled) but Math.round(0.4) === 0, so saveTrade()'s own
// guard silently returned with no insert, no alert, and no visible error —
// the modal just sat there. Now both use the same rounded check.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
let trades=[];
let tradeInserts=0;
function makeFrom(tbl){let op="select",payload=null;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=(r)=>{op="insert";payload=r;return b;};b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data;
   if(tbl==="trades"&&op==="select"){data=trades;}
   else if(op==="insert"){
     const withId=Object.assign({id:"new"+(++tradeInserts)},payload);
     data=withId;
     if(tbl==="trades") trades=trades.concat([withId]);
   }
   else{data=tbl==="user_settings"?null:[];}
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
const setVal=(el,v)=>{el.value=v;el.dispatchEvent(new window.Event("input",{bubbles:true}));};

setTimeout(()=>{try{
  click([...d.querySelectorAll("button")].find(b=>/Nueva operaci/.test(b.textContent)));
  const symbolInput=[...d.querySelectorAll("#modal-root input")].find(i=>i.getAttribute("placeholder")==="MES, NQ, SPY…");
  const contratosLabel=[...d.querySelectorAll("#modal-root label")].find(l=>l.querySelector("span")&&l.querySelector("span").textContent==="Contratos");
  const contratosInput=contratosLabel&&contratosLabel.querySelector("input");
  const nums=[...d.querySelectorAll("#modal-root input[type=number]")].filter(i=>i.getAttribute("placeholder")==="0.00");
  if(symbolInput) setVal(symbolInput,"MES");
  setVal(contratosInput,"0.4");
  setVal(nums[0],"5400"); setVal(nums[1],"5410");
  const saveBtn=[...d.querySelectorAll("#modal-root button")].find(b=>/Guardar operaci/.test(b.textContent));
  console.log("Save button reflects the invalid (rounds-to-zero) contracts as disabled:", /cursor:\s*not-allowed/.test(saveBtn.getAttribute("style")||""));
  click(saveBtn);
  setTimeout(()=>{try{
    console.log("No trade was inserted for contracts that round to zero:", trades.length===0);
    console.log("SAVE BUTTON CONTRACTS ROUNDING SMOKE OK");
  }catch(e){console.log("ERR2",e.message,e.stack);}},150);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
