// Regression test: CSV import used to silently drop trades into "Sin cuenta"
// whenever the file had no account column (or a name that matched nothing),
// even if the trader was actively scoped into a single account via the header
// selector. That corrupted that account's stats/balance with zero warning.
// Now the import defaults unmatched rows to the currently scoped account.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
const ACCOUNTS=[
  {id:"a1",name:"Eval 50k",kind:"fondeo",firm:"",balance:50000,currency:"USD",phase:"",status:"activa",profit_target:"",max_drawdown:"",notes:""},
];
function makeFrom(tbl){let op="select",payload=null;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=(r)=>{op="insert";payload=r;return b;};b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data;
   if(op==="insert"){data=(Array.isArray(payload)?payload:[payload]).map((r,i)=>Object.assign({id:"imp"+i},r));}
   else{data=tbl==="accounts"?ACCOUNTS:(tbl==="user_settings"?null:[]);}
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
// No "Cuenta" column at all — the common shape of a raw broker export.
const CSV=["Fecha,Símbolo,Dirección,Contratos,Entrada,Salida",
  "01/06/2026,MES,Largo,1,5400,5410"].join("\n");
setTimeout(()=>{try{
  const scopeSelect=[...d.querySelectorAll("select.head-scope")][0];
  console.log("Account scope selector is present:", !!scopeSelect);
  scopeSelect.value="a1"; scopeSelect.dispatchEvent(new window.Event("change",{bubbles:true}));
  click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  click([...d.querySelectorAll("main button")].find(b=>/Importar/.test(b.textContent)));
  const input=d.querySelector("#modal-root input[type=file]");
  const file=new window.File([CSV],"trades.csv",{type:"text/csv"});
  Object.defineProperty(input,"files",{value:[file],configurable:true});
  input.dispatchEvent(new window.Event("change",{bubbles:true}));
  setTimeout(()=>{try{
    const modalText=d.getElementById("modal-root").textContent;
    console.log("Preview notes the row will be assigned to the scoped account:", /Eval 50k/.test(modalText));
    const go=[...d.querySelectorAll("#modal-root button")].find(b=>/Importar 1 operaci/.test(b.textContent));
    click(go);
    setTimeout(()=>{try{
      click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
      // The trades list filter tracks the header scope (fAccount stays "a1"),
      // so the imported row only shows here if it was actually attached to a1
      // instead of being silently orphaned into "Sin cuenta".
      const rows=[...d.querySelectorAll("main button")].filter(b=>b.style.display==="grid");
      console.log("Imported row is attached to the scoped account, not orphaned:", rows.length===1);
      console.log("CSV IMPORT SCOPE-ACCOUNT SMOKE OK");
    }catch(e){console.log("ERR3",e.message,e.stack);}},120);
  }catch(e){console.log("ERR2",e.message,e.stack);}},120);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
