// Regression test: exportCSV() joined a trade's tags with a plain space
// (t.tags.join(" ")) and buildImportRow() split the Etiquetas cell on any
// whitespace run. A tag that itself contains a space — exactly what the
// app's own tag-input placeholder suggests ("NY open, breakout, BTC, 5m…")
// — was indistinguishable on export from a tag boundary: exporting
// ["NY open","breakout"] produced the cell "NY open breakout", and
// re-importing it yielded three tags ["NY","open","breakout"], permanently
// splitting "NY open" into two spurious tags. Tags now round-trip through
// the same comma convention used everywhere else in the app (parseTags,
// manual tag entry): export joins with ", ", import reuses parseTags().
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
const TRADES=[
  {id:"t1",date:"2026-06-01",time:"09:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5420,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:100,account_id:null,tags:["NY open","breakout"],mae:null,mfe:null},
];
function makeFrom(tbl){let op="select",payload=null;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=(r)=>{op="insert";payload=r;return b;};b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data;
   if(op==="insert"){data=(Array.isArray(payload)?payload:[payload]).map((r,i)=>Object.assign({id:"imp"+i},r));}
   else if(tbl==="trades")data=TRADES; else if(tbl==="user_settings")data={data:{rules:{},checklist:["x"],onboardingDone:true}}; else data=[];
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
let lastBlob=null;
window.URL.createObjectURL=(blob)=>{lastBlob=blob;return "blob:fake";};
window.URL.revokeObjectURL=()=>{};
// exportCSV() programmatically clicks a real <a href="blob:..."> to trigger
// the download; jsdom doesn't implement blob-URL navigation and logs an
// async, unpredictably-timed "not implemented" warning that can land in the
// middle of later steps in this test. Neutralize the anchor's real click so
// only our own href/download bookkeeping runs, same effect without the
// phantom navigation.
const realCreateElement=window.document.createElement.bind(window.document);
window.document.createElement=function(tag){
  var el=realCreateElement(tag);
  if (String(tag).toLowerCase()==="a") el.click=function(){};
  return el;
};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  // Part A: export. The multi-word tag must survive as a single comma-joined,
  // quoted CSV cell (not silently space-collapsed into export CSV).
  click([...d.querySelectorAll(".side button")].find(b=>/Operaciones/.test(b.textContent)));
  const csvBtn=[...d.querySelectorAll("button")].find(b=>/Exportar a CSV/.test(b.getAttribute("title")||""));
  click(csvBtn);
  console.log("CSV export produced a file:", !!lastBlob);
  lastBlob.text().then(function(exportedText){try{
    var row=exportedText.replace(/^﻿/,"").split(/\r?\n/)[1];
    console.log("Exported tags cell keeps the multi-word tag intact (comma-joined, quoted):", /"NY open, breakout"/.test(row));

    // Part B: import. Uses the exact cell shape the app's own export just
    // produced. This is the ONLY trade in the app for this part, so the
    // single resulting row is unambiguously the freshly-imported one.
    const CSV=["Fecha,Símbolo,Dirección,Contratos,Entrada,Salida,Etiquetas",
      "2026-06-05,NQ,Largo,1,19000,19050,\"NY open, breakout\""].join("\n");
    click([...d.querySelectorAll("main button")].find(b=>/Importar/.test(b.textContent)));
    const input=d.querySelector("#modal-root input[type=file]");
    const file=new window.File([CSV],"trades2.csv",{type:"text/csv"});
    Object.defineProperty(input,"files",{value:[file],configurable:true});
    input.dispatchEvent(new window.Event("change",{bubbles:true}));
    setTimeout(()=>{try{
      const go=[...d.querySelectorAll("#modal-root button")].find(b=>/Importar 1 operaci/.test(b.textContent));
      console.log("Import preview ready:", !!go);
      click(go);
      setTimeout(()=>{try{
        const row2=[...d.querySelectorAll("main button")].find(b=>b.style.display==="grid"&&/NQ/.test(b.textContent));
        click(row2);
        setTimeout(()=>{try{
          // Etiquetas is a label div immediately followed by a sibling div
          // whose children are one <span> per tag (detailDrawer()).
          const tagsLabel=[...d.querySelectorAll(".dc-drawer div")].find(el=>el.textContent==="Etiquetas");
          const tagTexts=tagsLabel?[...tagsLabel.nextElementSibling.children].map(function(s){return s.textContent;}):[];
          console.log("Re-imported trade has exactly 2 tags (not split into 3):", tagTexts.length===2);
          console.log("First tag is the whole multi-word \"NY open\", not just \"NY\":", tagTexts[0]==="NY open");
          console.log("Second tag is \"breakout\":", tagTexts[1]==="breakout");
          console.log("CSV TAGS ROUNDTRIP SMOKE OK");
        }catch(e){console.log("ERR5",e.message,e.stack);}},120);
      }catch(e){console.log("ERR4",e.message,e.stack);}},120);
    }catch(e){console.log("ERR3",e.message,e.stack);}},120);
  }catch(e){console.log("ERR2",e.message,e.stack);}});
}catch(e){console.log("ERR",e.message,e.stack);}},150);
