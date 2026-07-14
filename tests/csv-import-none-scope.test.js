// Regression test: importing a CSV with no recognized "Cuenta" column while
// scoped to "Sin cuenta" (state.scopeAccount === "none") must leave the
// imported rows unassigned (account_id: null), not write the literal string
// "none" as account_id. buildImportRow()'s scoped-default branch only
// excluded the "all" sentinel, not "none" — every other code path
// (scopedTrades, setScopeAccount) treats "none" as "no account" (null), so a
// bare "none" string reaching account_id (a nullable UUID FK) would be
// rejected by a real Supabase insert and silently retried forever via the
// offline outbox.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
const ACCOUNTS=[
  {id:"a1",name:"Eval 50k",kind:"fondeo",firm:"",balance:50000,currency:"USD",phase:"",status:"activa",profit_target:"",max_drawdown:"",notes:""},
];
var inserted=[];
function makeFrom(tbl){let op="select",payload=null;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=(r)=>{op="insert";payload=r;return b;};b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data;
   if(op==="insert"){
     var rows=Array.isArray(payload)?payload:[payload];
     if(tbl==="trades") inserted=inserted.concat(rows);
     data=rows.map((r,i)=>Object.assign({id:"imp"+i},r));
   }
   else{data=tbl==="accounts"?ACCOUNTS:(tbl==="user_settings"?null:[]);}
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
// No "Cuenta" column — the common shape of a raw broker export.
const CSV=["Fecha,Símbolo,Dirección,Contratos,Entrada,Salida",
  "01/06/2026,MES,Largo,1,5400,5410"].join("\n");
setTimeout(()=>{try{
  const scopeSelect=d.querySelector("select.head-scope");
  console.log("Account scope selector is present:", !!scopeSelect);
  scopeSelect.value="none"; scopeSelect.dispatchEvent(new window.Event("change",{bubbles:true}));
  click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  click([...d.querySelectorAll("main button")].find(b=>/Importar/.test(b.textContent)));
  const input=d.querySelector("#modal-root input[type=file]");
  const file=new window.File([CSV],"trades.csv",{type:"text/csv"});
  Object.defineProperty(input,"files",{value:[file],configurable:true});
  input.dispatchEvent(new window.Event("change",{bubbles:true}));
  setTimeout(()=>{try{
    const go=[...d.querySelectorAll("#modal-root button")].find(b=>/Importar 1 operaci/.test(b.textContent));
    click(go);
    setTimeout(()=>{try{
      console.log("Exactly one row was inserted:", inserted.length===1);
      console.log("Imported row's account_id is null, not the string \"none\":", inserted[0] && inserted[0].account_id===null);
      console.log("CSV IMPORT NONE-SCOPE SMOKE OK");
    }catch(e){console.log("ERR3",e.message,e.stack);}},120);
  }catch(e){console.log("ERR2",e.message,e.stack);}},120);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
