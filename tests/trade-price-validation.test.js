// Entry/exit prices must be positive on both entry paths. Before this fix,
// isSaveValid()/saveTrade() only checked entry/exit were non-empty finite
// numbers (not that they were > 0), and buildImportRow() (CSV import) only
// checked isNaN — so a sign typo (e.g. "-1900" instead of "1900") silently
// produced a wildly wrong P&L that then corrupted every downstream stat.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};
let trades=[];
let tradeInserts=0;
function makeFrom(tbl){let op="select",payload=null;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=(r)=>{op="insert";payload=r;return b;};b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data;
   if(tbl==="trades"&&op==="select"){data=trades;}
   else if(op==="insert"){
     const rows=(Array.isArray(payload)?payload:[payload]).map(r=>Object.assign({id:"new"+(++tradeInserts)},r));
     data=Array.isArray(payload)?rows:rows[0];
     if(tbl==="trades") trades=trades.concat(rows);
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
  const symbol=d.querySelector("#modal-root input[placeholder*='MES']");
  setVal(symbol,"MES");
  const nums=[...d.querySelectorAll("#modal-root input[type=number]")].filter(i=>i.getAttribute("placeholder")==="0.00");
  const saveBtn=[...d.querySelectorAll("#modal-root button")].find(b=>/Guardar operaci/.test(b.textContent));

  // Negative entry (sign typo) with a valid exit -> save must stay disabled.
  // (Deliberately not clicking: on the pre-fix code this would silently
  // proceed with the async save and pollute the state for later steps.)
  setVal(nums[0],"-5400"); setVal(nums[1],"5410");
  console.log("Negative entry keeps save disabled:", /not-allowed/.test(saveBtn.style.cssText));

  // Zero exit -> also invalid.
  setVal(nums[0],"5400"); setVal(nums[1],"0");
  console.log("Zero exit keeps save disabled:", /not-allowed/.test(saveBtn.style.cssText));

  // Valid positive prices -> enabled and saves normally.
  setVal(nums[0],"5400"); setVal(nums[1],"5410");
  console.log("Valid positive prices enable save:", !/not-allowed/.test(saveBtn.style.cssText));
  click(saveBtn);
  setTimeout(()=>{try{
    console.log("Valid trade is inserted:", trades.length===1);

    // --- CSV import path: same guard via buildImportRow ---
    click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
    click([...d.querySelectorAll("main button")].find(b=>/Importar/.test(b.textContent)));
    const CSV=["Fecha,Símbolo,Dirección,Contratos,Entrada,Salida",
      "2026-06-01,NQ,Largo,1,-18000,18010",
      "2026-06-02,ES,Corto,1,5400,5405"].join("\n");
    const input=d.querySelector("#modal-root input[type=file]");
    const file=new window.File([CSV],"trades.csv",{type:"text/csv"});
    Object.defineProperty(input,"files",{value:[file],configurable:true});
    input.dispatchEvent(new window.Event("change",{bubbles:true}));
    setTimeout(()=>{try{
      const mr=d.getElementById("modal-root").textContent;
      console.log("CSV row with negative entry is flagged invalid:", /1 fila\(s\) con error/.test(mr));
      console.log("CSV import preview only accepts the 1 valid row:", /1 operaci/.test(mr));
      console.log("TRADE PRICE VALIDATION SMOKE OK");
    }catch(e){console.log("ERR3",e.message,e.stack);}},120);
  }catch(e){console.log("ERR2",e.message,e.stack);}},120);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
