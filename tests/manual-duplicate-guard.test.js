// Only CSV import warned about duplicate fills; manual entry of the exact
// same trade twice (same date/symbol/side/contracts/entry/exit) inserted
// silently. Manual entry should now ask for confirmation, matching the same
// identity key CSV import already uses.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
let tradeInserts=0;
function makeFrom(tbl){let op="select",payload=null,single=false;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>{single=true;return b;};b.maybeSingle=()=>{single=true;return b;};
 b.insert=(r)=>{op="insert";payload=r;if(tbl==="trades")tradeInserts++;return b;};
 b.update=(r)=>{op="update";payload=r;return b;};b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>new Promise(function(resolve){setTimeout(function(){
   let data;
   if(op==="insert"){const withId=Object.assign({id:"new"+Math.random()},payload);data=single?withId:[withId];}
   else{data=tbl==="trades"?[]:(tbl==="user_settings"?null:[]);if(single&&Array.isArray(data))data=data[0]||null;}
   resolve({data,error:null});
 },30);}).then(res,rej);
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
const setVal=(el,v)=>{el.value=v;el.dispatchEvent(new window.Event("input",{bubbles:true}));};
function enterTrade(){
  click([...d.querySelectorAll("button")].find(b=>/Nueva operaci/.test(b.textContent)));
  const dateInput=d.querySelector("#modal-root input[type=date]");
  if(dateInput) setVal(dateInput,"2026-06-15");
  const nums=[...d.querySelectorAll("#modal-root input[type=number]")].filter(i=>i.getAttribute("placeholder")==="0.00");
  setVal(nums[0],"5400"); setVal(nums[1],"5420");
  const saveBtn=[...d.querySelectorAll("#modal-root button")].find(b=>/Guardar operaci/.test(b.textContent));
  click(saveBtn);
}
let confirmCalls=0; window.confirm=()=>{confirmCalls++; return false;}; // decline on the duplicate prompt
setTimeout(()=>{try{
  enterTrade();
  setTimeout(()=>{try{
    console.log("First entry inserted with no confirm prompt:", tradeInserts===1 && confirmCalls===0);
    enterTrade(); // identical date/symbol/side/contracts/entry/exit
    setTimeout(()=>{try{
      console.log("Second identical entry triggers a duplicate confirm:", confirmCalls===1);
      console.log("Declining the confirm blocks the second insert:", tradeInserts===1);
      // Now accept the confirm and confirm the second (truly duplicate) trade goes through.
      window.confirm=()=>{confirmCalls++; return true;};
      enterTrade();
      setTimeout(()=>{try{
        console.log("Accepting the confirm allows the duplicate to save:", tradeInserts===2);
        console.log("MANUAL DUPLICATE GUARD SMOKE OK");
      }catch(e){console.log("ERR3",e.message,e.stack);}},120);
    }catch(e){console.log("ERR2",e.message,e.stack);}},120);
  }catch(e){console.log("ERR1",e.message,e.stack);}},120);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
