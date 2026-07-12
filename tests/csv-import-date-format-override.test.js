// Regression test: the "Formato de fecha" dropdown (auto/dmy/mdy) wrote the
// user's choice to state.import.dateFormat, but importPreview() never read
// it — it always called detectDateOrder(), a heuristic that only resolves
// the convention if some row in the file happens to be unambiguous (a part
// >12). For a file where every date is genuinely ambiguous, detectDateOrder
// returns null and importDate() silently falls back to day-first, ignoring
// an explicit "Mes/Día/Año" selection from the user.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
function makeFrom(tbl){let op="select",payload=null;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=(r)=>{op="insert";payload=r;return b;};b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data;
   if(op==="insert"){data=(Array.isArray(payload)?payload:[payload]).map((r,i)=>Object.assign({id:"imp"+i},r));}
   else{data=tbl==="user_settings"?null:[];}
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
// Every date here is genuinely ambiguous (both parts <=12), written US-style
// (month/day/year): 02/03 = Feb 3, 01/05 = Jan 5. Without the override the
// app has no way to know that and defaults to day-first (3 Feb, 5 Ene).
const CSV=["Fecha,Símbolo,Dirección,Contratos,Entrada,Salida",
  "02/03/2026,MES,Largo,1,5400,5410",
  "01/05/2026,NQ,Largo,1,18000,18010"].join("\n");
setTimeout(()=>{try{
  click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  click([...d.querySelectorAll("main button")].find(b=>/Importar/.test(b.textContent)));
  const input=d.querySelector("#modal-root input[type=file]");
  const file=new window.File([CSV],"trades.csv",{type:"text/csv"});
  Object.defineProperty(input,"files",{value:[file],configurable:true});
  input.dispatchEvent(new window.Event("change",{bubbles:true}));
  setTimeout(()=>{try{
    const selects=[...d.querySelectorAll("#modal-root select")];
    const dfSel=selects[selects.length-1];
    dfSel.value="mdy"; dfSel.dispatchEvent(new window.Event("change",{bubbles:true}));
    setTimeout(()=>{try{
      const go=[...d.querySelectorAll("#modal-root button")].find(b=>/Importar 2 operaciones/.test(b.textContent));
      console.log("Both rows still accepted as valid:", !!go);
      click(go);
      setTimeout(()=>{try{
        const rows=[...d.querySelectorAll("main button")].filter(b=>b.style.display==="grid");
        console.log("Explicit MM/DD/AAAA override applied (3 Feb, not 2 Mar):", rows.some(r=>/3 Feb/i.test(r.textContent)) && !rows.some(r=>/2 Mar/i.test(r.textContent)));
        console.log("Explicit MM/DD/AAAA override applied (5 Ene, not 1 May):", rows.some(r=>/5 Ene/i.test(r.textContent)) && !rows.some(r=>/1 May/i.test(r.textContent)));
        console.log("CSV IMPORT DATE FORMAT OVERRIDE SMOKE OK");
      }catch(e){console.log("ERR3",e.message,e.stack);}},120);
    }catch(e){console.log("ERR2",e.message,e.stack);}},20);
  }catch(e){console.log("ERR",e.message,e.stack);}},120);
}catch(e){console.log("ERR4",e.message,e.stack);}},150);
