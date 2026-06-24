const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};
// rating positively correlated with pnl; FOMO losing
const mk=(id,date,rating,emotion,pnl,time)=>({id,date,time:time||"",symbol:"MES",type:"future",side:pnl>=0?"long":"short",contracts:Math.abs(rating),entry:5400,exit:5400+pnl/5,setup:rating>=4?"Ruptura":"Pullback",emotion,rating,note:"",pnl,account_id:null,tags:rating>=4?["A+"]:["B"],mae:"",mfe:""});
const TRADES=[mk("a","2026-06-15",5,"Confiado",200,"09:30"),mk("b","2026-06-16",4,"Confiado",120,"10:00"),mk("c","2026-06-17",4,"Tranquilo",90,"15:00"),mk("d","2026-06-18",3,"Tranquilo",10,"11:00"),mk("e","2026-06-19",2,"Ansioso",-130,"03:00"),mk("f","2026-06-20",1,"FOMO",-220,"16:00")];
function makeFrom(tbl){let op="select";const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=r=>{op="insert";return b;};b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data; if(op==="select"){data=tbl==="trades"?TRADES:(tbl==="user_settings"?null:[]);}else data=null; return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  console.log("Nav has Correlaciones:", [...d.querySelectorAll("aside nav button")].some(b=>/Correlaciones/.test(b.textContent)));
  click([...d.querySelectorAll("aside nav button")].find(b=>/Correlaciones/.test(b.textContent)));
  const main=d.querySelector("main");
  console.log("Influence panel:", /Qué influye en tu P&L/.test(main.textContent));
  console.log("Best/worst panel:", /Tu mejor y peor contexto/.test(main.textContent)&&/Mejor:/.test(main.textContent)&&/Peor:/.test(main.textContent));
  console.log("Valoración row + positive r:", /Valoración/.test(main.textContent)&&/positiva/.test(main.textContent));
  console.log("Explorer + Pearson + scatter svg:", /Explorador/.test(main.textContent)&&/Correlación de Pearson/.test(main.textContent)&&main.querySelectorAll("svg").length>=1);
  // switch factor to emotion (categorical)
  const selects=[...main.querySelectorAll("select")];
  const factorSel=selects[0];
  factorSel.value="emotion"; factorSel.dispatchEvent(new window.Event("change",{bubbles:true}));
  setTimeout(()=>{
    const m2=d.querySelector("main");
    console.log("Categorical explorer shows emotions:", /FOMO/.test(m2.textContent)&&/Confiado/.test(m2.textContent));
    // switch result to winrate
    const rsel=[...m2.querySelectorAll("select")][1];
    rsel.value="winrate"; rsel.dispatchEvent(new window.Event("change",{bubbles:true}));
    setTimeout(()=>{
      const m3=d.querySelector("main");
      console.log("Winrate result shows %:", /%/.test(m3.querySelector("main")?"":m3.textContent) && /op/.test(m3.textContent));
      console.log("Caveat present:", /no implica causalidad/.test(m3.textContent));
      console.log("CORRELATIONS SMOKE OK");
    },30);
  },30);
}catch(e){console.log("ERR",e.message,e.stack);}},120);
