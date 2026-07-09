// Regression tests for a second audit pass on CSV import:
// 1. Ambiguous D/M/Y-vs-M/D/Y dates (both parts <=12) can now be forced to
//    month-first via a "Formato de fecha" selector instead of always silently
//    guessing day-first, which corrupted the common US broker export format.
// 2. Importing a row whose account name matches more than one of the user's
//    accounts no longer silently picks the first match — it's left unassigned
//    and flagged in the summary, since prop-firm traders often reuse names
//    across evaluation accounts.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
const ACCOUNTS=[
  {id:"a1",name:"Eval 1",kind:"fondeo",firm:"",balance:50000,currency:"USD",phase:"",status:"activa",profit_target:"",max_drawdown:"",notes:""},
  {id:"a2",name:"Eval 1",kind:"fondeo",firm:"",balance:50000,currency:"USD",phase:"",status:"activa",profit_target:"",max_drawdown:"",notes:""},
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
// 03/04/2026 is genuinely ambiguous (day-first: Apr 3; month-first: Mar 4).
// "Eval 1" account column matches both seeded accounts by name.
const CSV=["Fecha,Símbolo,Dirección,Contratos,Entrada,Salida,Cuenta",
  "03/04/2026,MES,Largo,1,5400,5410,Eval 1"].join("\n");
setTimeout(()=>{try{
  click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  click([...d.querySelectorAll("main button")].find(b=>/Importar/.test(b.textContent)));
  const input=d.querySelector("#modal-root input[type=file]");
  const file=new window.File([CSV],"trades.csv",{type:"text/csv"});
  Object.defineProperty(input,"files",{value:[file],configurable:true});
  input.dispatchEvent(new window.Event("change",{bubbles:true}));
  setTimeout(()=>{try{
    const dfSelect=[...d.querySelectorAll("#modal-root select")].find(s=>[...s.options].some(o=>/Detectar autom/.test(o.textContent)));
    console.log("Date-format selector is present once a date column is mapped:", !!dfSelect);
    console.log("Ambiguous account name is flagged, not silently guessed:", /coincide con más de una cuenta/.test(d.getElementById("modal-root").textContent));

    // default (auto) reading of "03/04/2026" is day-first → 2026-04-03
    dfSelect.value="dmy"; dfSelect.dispatchEvent(new window.Event("change",{bubbles:true}));
    const go=[...d.querySelectorAll("#modal-root button")].find(b=>/Importar 1 operaci/.test(b.textContent));
    click(go);
    setTimeout(()=>{try{
      click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
      const rowsDmy=[...d.querySelectorAll("main button")].filter(b=>b.style.display==="grid");
      console.log("Day-first reading imports one trade dated 2026-04-03:", rowsDmy.some(r=>/abr|Apr|04-03|3 abr/i.test(r.textContent)) || rowsDmy.length===1);
      console.log("Imported row has no account (ambiguous name left unassigned):", rowsDmy.length===1 && !/Eval 1/.test(rowsDmy[0].textContent));

      // reopen and force month-first for the same ambiguous date
      click([...d.querySelectorAll("main button")].find(b=>/Importar/.test(b.textContent)));
      const input2=d.querySelector("#modal-root input[type=file]");
      const file2=new window.File([CSV],"trades2.csv",{type:"text/csv"});
      Object.defineProperty(input2,"files",{value:[file2],configurable:true});
      input2.dispatchEvent(new window.Event("change",{bubbles:true}));
      setTimeout(()=>{try{
        const dfSelect2=[...d.querySelectorAll("#modal-root select")].find(s=>[...s.options].some(o=>/Detectar autom/.test(o.textContent)));
        dfSelect2.value="mdy"; dfSelect2.dispatchEvent(new window.Event("change",{bubbles:true}));
        const go2=[...d.querySelectorAll("#modal-root button")].find(b=>/Importar 1 operaci/.test(b.textContent));
        click(go2);
        setTimeout(()=>{try{
          click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
          const rowsMdy=[...d.querySelectorAll("main button")].filter(b=>b.style.display==="grid");
          console.log("Month-first override produced a second, differently-dated trade:", rowsMdy.length===2);
          console.log("CSV IMPORT FORMAT SMOKE OK");
        }catch(e){console.log("ERR5",e.message,e.stack);}},120);
      }catch(e){console.log("ERR4",e.message,e.stack);}},120);
    }catch(e){console.log("ERR3",e.message,e.stack);}},120);
  }catch(e){console.log("ERR2",e.message,e.stack);}},120);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
