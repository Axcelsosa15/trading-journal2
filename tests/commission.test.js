// Commission/fees tracking: pnl must be stored net of commission everywhere a
// trade is saved (manual entry + CSV import), and the fee drag must be visible
// (form preview, dashboard KPI, trade detail, CSV/tax exports) instead of
// silently folded into a single gross-dressed-as-net number.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
let insertedRow=null;
function makeFrom(tbl){let op="select",payload=null,single=false;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>{single=true;return b;};b.maybeSingle=()=>{single=true;return b;};
 b.insert=(r)=>{op="insert";payload=r;if(tbl==="trades")insertedRow=r;return b;};b.update=(r)=>{op="update";payload=r;return b;};b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data;
   if(op==="insert"||op==="update"){const withId=Object.assign({id:"new1"},payload);data=single?withId:[withId];}
   else{data=tbl==="trades"?[]:(tbl==="user_settings"?null:[]);if(single&&Array.isArray(data))data=data[0]||null;}
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
window.URL.createObjectURL=()=>"blob:fake"; window.URL.revokeObjectURL=()=>{};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
const setVal=(el,v)=>{el.value=v;el.dispatchEvent(new window.Event("input",{bubbles:true}));};
setTimeout(()=>{try{
  click([...d.querySelectorAll("button")].find(b=>/Nueva operaci/.test(b.textContent)));
  const numInputs=[...d.querySelectorAll("#modal-root input[type=number]")].filter(i=>i.getAttribute("placeholder")==="0.00");
  setVal(numInputs[0],"5400"); setVal(numInputs[1],"5420"); // MES: 5pt/pt * 5 contracts default 1 => (20)*5=100 gross
  const commInput=[...d.querySelectorAll("#modal-root input[type=number]")].find(i=>i.getAttribute("min")==="0" && i.getAttribute("step")==="0.01" && i.getAttribute("placeholder")==="0.00" && i!==numInputs[0] && i!==numInputs[1]);
  setVal(commInput,"5");
  const preview=[...d.querySelectorAll("#modal-root")][0].textContent;
  console.log("Preview shows net (bruto/comisión/neto breakdown):", /bruto/.test(preview) && /comisi/.test(preview));
  const saveBtn=[...d.querySelectorAll("#modal-root button")].find(b=>/Guardar operaci/.test(b.textContent));
  console.log("Save enabled with a valid non-negative commission:", saveBtn.style.cursor!=="not-allowed");
  setVal(commInput,"-5");
  console.log("Save disabled on negative commission:", saveBtn.style.cursor==="not-allowed");
  setVal(commInput,"5");
  click(saveBtn);
  setTimeout(()=>{try{
    console.log("Saved row carries commission:", insertedRow && insertedRow.commission===5);
    console.log("Saved pnl is net of commission (100-5=95):", insertedRow && insertedRow.pnl===95);
    click([...d.querySelectorAll(".side button")].find(b=>/Resumen/.test(b.textContent)));
    const dash=window.document.querySelector("main").textContent;
    console.log("Dashboard KPI mentions commission total:", /comisiones/.test(dash));
    console.log("COMMISSION SMOKE OK");
  }catch(e){console.log("ERR2",e.message,e.stack);}},120);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
