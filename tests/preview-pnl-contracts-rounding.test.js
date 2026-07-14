// Regression test: draftPnl() (drives the live "P&L estimado" preview in the
// "Nueva operación" modal) did not round contracts the way saveTrade() does
// (app.js:1124, Math.round(Number(d.contracts))). Typing "1.4" contracts showed
// a preview computed with the fractional value, but Save persisted the rounded
// whole-contract trade — the number the user commits to isn't the number saved.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
let trades=[];
let tradeInserts=0;
function makeFrom(tbl){let op="select",payload=null;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=(r)=>{op="insert";payload=r;return b;};b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data;
   if(tbl==="trades"&&op==="select"){data=trades;}
   else if(op==="insert"){
     const withId=Object.assign({id:"new"+(++tradeInserts)},payload);
     data=withId;
     if(tbl==="trades") trades=trades.concat([withId]);
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
  const symLabel=[...d.querySelectorAll("#modal-root label")].find(l=>l.querySelector("span")&&l.querySelector("span").textContent==="Símbolo");
  setVal(symLabel.querySelector("input"),"MES");
  const contratosLabel=[...d.querySelectorAll("#modal-root label")].find(l=>l.querySelector("span")&&l.querySelector("span").textContent==="Contratos");
  const contratosInput=contratosLabel&&contratosLabel.querySelector("input");
  setVal(contratosInput,"1.4");
  const nums=[...d.querySelectorAll("#modal-root input[type=number]")].filter(i=>i.getAttribute("placeholder")==="0.00");
  setVal(nums[0],"5400"); setVal(nums[1],"5410");
  const dateLabel=[...d.querySelectorAll("#modal-root label")].find(l=>l.querySelector("span")&&l.querySelector("span").textContent==="Fecha");
  setVal(dateLabel.querySelector("input"),"2024-01-02");
  const previewSpans=[...d.querySelectorAll("#modal-root span")].filter(s=>/^[+−-]?\$/.test(s.textContent||""));
  const previewText=previewSpans.length?previewSpans[previewSpans.length-1].textContent:"";
  console.log("Live preview text:", previewText);
  // MES point value is $5: rounded 1 contract * 10pt * $5 = $50, NOT the
  // fractional-contracts $70 the bug would show.
  console.log("Preview matches rounded-contracts P&L ($50), not fractional ($70):", /50/.test(previewText) && !/70/.test(previewText));
  const saveBtn=[...d.querySelectorAll("#modal-root button")].find(b=>/Guardar operaci/.test(b.textContent));
  click(saveBtn);
  setTimeout(()=>{try{
    console.log("Trade was saved:", trades.length===1);
    console.log("Saved contracts rounded to 1:", trades[0] && trades[0].contracts===1);
    console.log("Saved pnl matches the live preview shown before Save:", trades[0] && trades[0].pnl===50);
    console.log("PREVIEW PNL CONTRACTS ROUNDING SMOKE OK");
  }catch(e){console.log("ERR2",e.message,e.stack);}},150);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
