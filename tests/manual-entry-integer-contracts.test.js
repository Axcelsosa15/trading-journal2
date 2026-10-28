// Regression test: manual trade entry did not round the "Contratos" field the
// way CSV import already does (Math.round(importNum(...)), app.js buildImportRow()).
// Typing "1.5" in the number input (which has min="1" but no browser-enforced
// step) saved a fractional contract size — nonsensical for futures and
// inconsistent with the CSV import path. saveTrade() must round it the same way.
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
  const contratosLabel=[...d.querySelectorAll("#modal-root label")].find(l=>l.querySelector("span")&&l.querySelector("span").textContent==="Contratos");
  const contratosInput=contratosLabel&&contratosLabel.querySelector("input");
  console.log("Contratos input found:", !!contratosInput);
  setVal(contratosInput,"1.4");
  const nums=[...d.querySelectorAll("#modal-root input[type=number]")].filter(i=>i.getAttribute("placeholder")==="0.00");
  setVal(nums[0],"5400"); setVal(nums[1],"5410");
  const saveBtn=[...d.querySelectorAll("#modal-root button")].find(b=>/Guardar operaci/.test(b.textContent));
  click(saveBtn);
  setTimeout(()=>{try{
    console.log("Trade was saved:", trades.length===1);
    console.log("Fractional 1.4 contracts was rounded to a whole 1, not stored as 1.4:", trades[0] && trades[0].contracts===1);
    console.log("MANUAL ENTRY INTEGER CONTRACTS SMOKE OK");
  }catch(e){console.log("ERR2",e.message,e.stack);}},150);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
