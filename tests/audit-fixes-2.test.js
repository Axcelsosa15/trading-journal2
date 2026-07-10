// Regression tests for a second audit pass:
// 1. A manually-typed futures symbol with a stray trailing space (e.g. "YM ")
//    must still resolve its real point value — PV()/knownFuturesSymbol() now
//    trim before lookup, and the stored symbol is trimmed too.
// 2. A trade dated in the future is rejected by saveTrade() (and isSaveValid()),
//    not silently saved to pollute risk-rule counters/calendar/streaks.
// 3. A screenshot upload failure no longer fails silently: the trade still
//    saves, but the user is told the image didn't attach.
// 4. The sidebar balance no longer sums account balances across currencies —
//    it sums the majority currency only and flags how many accounts were left out.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
const ACCOUNTS=[
  {id:"a1",name:"Fondeo USD",kind:"fondeo",firm:"",balance:10000,currency:"USD",phase:"",status:"activa",profit_target:"",max_drawdown:"",notes:""},
  {id:"a2",name:"Cuenta EUR",kind:"live",firm:"",balance:5000,currency:"EUR",phase:"",status:"activa",profit_target:"",max_drawdown:"",notes:""},
];
let uploadShouldFail=false, lastInsertPayload=null;
const storage={from:(bucket)=>({
  upload:async(path,file,opts)=>uploadShouldFail?{data:null,error:{message:"boom"}}:{data:{path},error:null},
  createSignedUrl:async(path,exp)=>({data:{signedUrl:"https://signed.example/"+encodeURIComponent(path)},error:null}),
})};
function makeFrom(tbl){let op="select",payload=null,single=false;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>{single=true;return b;};b.maybeSingle=()=>{single=true;return b;};
 b.insert=(r)=>{op="insert";payload=r;if(tbl==="trades")lastInsertPayload=Array.isArray(r)?r[0]:r;return b;};
 b.update=(r)=>{op="update";payload=r;return b;};b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data;
   if(op==="insert"||op==="update"){const withId=Object.assign({id:"new1"},payload);data=single?withId:[withId];}
   else{data=tbl==="trades"?[]:(tbl==="accounts"?ACCOUNTS:(tbl==="user_settings"?null:[]));if(single&&Array.isArray(data))data=data[0]||null;}
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom,storage})};
const alerts=[]; window.alert=(m)=>alerts.push(String(m));
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
const fireInput=el=>el.dispatchEvent(new window.Event("input",{bubbles:true}));

setTimeout(()=>{try{
  // --- 4. multi-currency sidebar total ---
  const sideText=d.querySelector(".side").textContent;
  console.log("Sidebar sums only the majority currency (USD 10,000), not a naive 15,000:", /\$10,000/.test(sideText) && !/\$15,000/.test(sideText));
  console.log("Sidebar flags the excluded EUR account:", /1 cuenta\(s\) en otra moneda/.test(sideText));

  // --- open the trade form ---
  click([...d.querySelectorAll("button")].find(b=>/Nueva operaci/.test(b.textContent)));
  const symbolInput=d.querySelector("#modal-root input[placeholder*='MES']");
  const nums=[...d.querySelectorAll("#modal-root input[type=number]")].filter(i=>i.getAttribute("placeholder")==="0.00");
  const entryInput=nums[0], exitInput=nums[1];
  const dateInput=d.querySelector("#modal-root input[type=date]");

  // --- 1. symbol trim ---
  symbolInput.value="YM "; fireInput(symbolInput);
  entryInput.value="100"; fireInput(entryInput);
  exitInput.value="101"; fireInput(exitInput);
  const afterTrim=d.querySelector("#modal-root").textContent;
  console.log("Untrimmed 'YM ' is still recognized (no fallback warning):", !/no reconocido/.test(afterTrim));
  console.log("Preview P&L uses YM's real point value ($5), not the $1 fallback:", /\+\$5(?!\d)/.test(afterTrim) && !/\+\$1(?!\d)/.test(afterTrim));

  // --- 2. future-date guard ---
  const future=new Date(Date.now()+7*86400000);
  const futureISO=future.getFullYear()+"-"+String(future.getMonth()+1).padStart(2,"0")+"-"+String(future.getDate()).padStart(2,"0");
  dateInput.value=futureISO; fireInput(dateInput);
  const saveBtn=[...d.querySelectorAll("#modal-root button")].find(b=>/Guardar operaci/.test(b.textContent));
  click(saveBtn);
  setTimeout(()=>{try{
    const stillOpen=d.getElementById("modal-root").children.length>0;
    console.log("Future-dated trade is rejected (modal stays open, nothing saved):", stillOpen && lastInsertPayload===null);

    // --- 3. screenshot upload failure is surfaced, trade still saves ---
    const todayISO=(function(){const n=new Date();return n.getFullYear()+"-"+String(n.getMonth()+1).padStart(2,"0")+"-"+String(n.getDate()).padStart(2,"0");})();
    dateInput.value=todayISO; fireInput(dateInput);
    uploadShouldFail=true;
    const fileInput=d.querySelector("#modal-root input[type=file]");
    const file=new window.File([Buffer.from([1,2,3])],"chart.png",{type:"image/png"});
    Object.defineProperty(fileInput,"files",{value:[file],configurable:true});
    fileInput.dispatchEvent(new window.Event("change",{bubbles:true}));
    setTimeout(()=>{try{
      const save2=[...d.querySelectorAll("#modal-root button")].find(b=>/Guardar operaci/.test(b.textContent));
      click(save2);
      setTimeout(()=>{try{
        console.log("Trade saves despite the screenshot upload failing:", lastInsertPayload!==null);
        console.log("Symbol is trimmed before storage ('YM', not 'YM '):", lastInsertPayload && lastInsertPayload.symbol==="YM");
        console.log("User is told the screenshot didn't upload:", alerts.some(a=>/captura/i.test(a)));
        console.log("Modal closed after the (successful) save:", d.getElementById("modal-root").children.length===0);
        console.log("AUDIT FIXES 2 SMOKE OK");
      }catch(e){console.log("ERR4",e.message,e.stack);}},140);
    }catch(e){console.log("ERR3",e.message,e.stack);}},80);
  }catch(e){console.log("ERR2",e.message,e.stack);}},80);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
