// importNum() must correctly read both US (1,234.56) and European (1.234,56)
// formatted numbers from a broker CSV — picking the wrong decimal separator
// silently corrupts entry/exit prices (and therefore P&L) by ~1000x.
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
// European format: entry 5.400,50 (=5400.50), exit 5.420,75 (=5420.75).
// MES point value $5 -> (5420.75-5400.50)*5 = 101.25 -> rounds to $101.
// US format row alongside it, to confirm both conventions still work together.
const CSV=["Fecha,Símbolo,Dirección,Contratos,Entrada,Salida",
  "2026-06-01,MES,Largo,1,\"5.400,50\",\"5.420,75\"",
  "2026-06-02,MES,Largo,1,\"5,400.50\",\"5,420.75\""].join("\n");
setTimeout(()=>{try{
  click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  click([...d.querySelectorAll("main button")].find(b=>/Importar/.test(b.textContent)));
  const input=d.querySelector("#modal-root input[type=file]");
  const file=new window.File([CSV],"trades.csv",{type:"text/csv"});
  Object.defineProperty(input,"files",{value:[file],configurable:true});
  input.dispatchEvent(new window.Event("change",{bubbles:true}));
  setTimeout(()=>{try{
    const mr=d.getElementById("modal-root").textContent;
    console.log("Both rows parsed as valid (2 ready):", /2 operaci/.test(mr));
    const go=[...d.querySelectorAll("#modal-root button")].find(b=>/Importar 2 operaciones/.test(b.textContent));
    click(go);
    setTimeout(()=>{try{
      const rows=[...d.querySelectorAll("main button")].filter(b=>b.style.display==="grid");
      const eurRow=rows.find(r=>/^1 Jun/.test(r.textContent));
      console.log("European-format row present:", !!eurRow);
      console.log("European-format P&L correct ($101, not ~$0 or ~$5):", eurRow && /\$101\b/.test(eurRow.textContent));
      const usRow=rows.find(r=>/^2 Jun/.test(r.textContent));
      console.log("US-format row present:", !!usRow);
      console.log("US-format P&L still correct ($101):", usRow && /\$101\b/.test(usRow.textContent));
      console.log("CSV NUMERIC FORMATS SMOKE OK");
    }catch(e){console.log("ERR3",e.message,e.stack);}},120);
  }catch(e){console.log("ERR2",e.message,e.stack);}},120);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
