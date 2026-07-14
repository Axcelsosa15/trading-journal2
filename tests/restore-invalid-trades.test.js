// Regression test: manual entry and CSV import both reject non-positive
// entry/exit prices, future-dated trades, and impossible calendar dates —
// but runRestore() (the "Restaurar backup" JSON path) only coerced fields
// with Number(...), applying none of that validation. A hand-edited or
// corrupted backup file could reintroduce exactly the bad data the other two
// entry points now block. runRestore() must skip invalid trades instead of
// upserting them, and tell the user how many were skipped.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
let alerts=[];
window.alert=function(msg){alerts.push(msg);};

let DB={ trades:[], accounts:[], journal:[] };
function makeFrom(tbl){let op="select",payload=null,single=false;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>{single=true;return b;};b.maybeSingle=()=>{single=true;return b;};
 b.insert=(r)=>{op="insert";payload=r;return b;};b.update=(r)=>{op="update";payload=r;return b;};
 b.upsert=(r)=>{op="upsert";payload=r;return b;};b.delete=()=>{op="delete";return b;};
 b.then=(res,rej)=>{
   if(tbl==="user_settings"){ return Promise.resolve({data:null,error:null}).then(res,rej); }
   var list=DB[tbl]||[]; var data;
   if(op==="select"){ data = single ? (list[0]||null) : list.slice(); }
   else if(op==="upsert"){
     var rows=Array.isArray(payload)?payload:[payload];
     rows.forEach(function(row){
       var idx=list.findIndex(function(x){return x.id===row.id;});
       if(idx>=0) list[idx]=Object.assign({},list[idx],row); else list.push(Object.assign({},row));
     });
     DB[tbl]=list; data = single?rows[0]:rows;
   } else { data = single?null:[]; }
   return Promise.resolve({data,error:null}).then(res,rej);
 };
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));

const BACKUP={
  app:"Bitacora", exported_at:"2026-06-15T00:00:00.000Z",
  accounts:[],
  trades:[
    {id:"good1",date:"2026-06-01",time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:100,exit:110,setup:"Ruptura",emotion:"Tranquilo",rating:3,note:"ok",pnl:50,commission:0,account_id:null,tags:[],mae:null,mfe:null,screenshot_path:null},
    {id:"bad-future",date:"2099-12-31",time:"10:00",symbol:"NQ",type:"future",side:"long",contracts:1,entry:18000,exit:18010,setup:"Ruptura",emotion:"Tranquilo",rating:3,note:"future-dated",pnl:100,commission:0,account_id:null,tags:[],mae:null,mfe:null,screenshot_path:null},
    {id:"bad-price",date:"2026-06-02",time:"10:00",symbol:"ES",type:"future",side:"long",contracts:1,entry:-1900,exit:1910,setup:"Ruptura",emotion:"Tranquilo",rating:3,note:"negative entry",pnl:5000,commission:0,account_id:null,tags:[],mae:null,mfe:null,screenshot_path:null},
    {id:"bad-date",date:"2026-04-31",time:"10:00",symbol:"YM",type:"future",side:"long",contracts:1,entry:38000,exit:38010,setup:"Ruptura",emotion:"Tranquilo",rating:3,note:"April has 30 days",pnl:10,commission:0,account_id:null,tags:[],mae:null,mfe:null,screenshot_path:null},
  ],
  journal:[],
  settings:{ rules:{maxTradesPerDay:5,maxDailyLoss:200,maxWeeklyLoss:600}, checklist:["Plan escrito"], onboardingDone:true },
};

setTimeout(()=>{try{
  click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  const restoreBtn=[...d.querySelectorAll("main button")].find(b=>/Restaurar/.test(b.textContent));
  click(restoreBtn);
  const input=d.querySelector("#modal-root input[type=file]");
  const file=new window.File([JSON.stringify(BACKUP)],"bitacora-backup-2026-06-15.json",{type:"application/json"});
  Object.defineProperty(input,"files",{value:[file],configurable:true});
  input.dispatchEvent(new window.Event("change",{bubbles:true}));
  setTimeout(()=>{try{
    const go=[...d.querySelectorAll("#modal-root button")].find(b=>/Restaurar backup/.test(b.textContent));
    click(go);
    setTimeout(()=>{try{
      console.log("Only the valid trade was inserted:", DB.trades.length===1 && DB.trades[0].id==="good1");
      console.log("The future-dated trade was skipped:", !DB.trades.some(t=>t.id==="bad-future"));
      console.log("The negative-entry-price trade was skipped:", !DB.trades.some(t=>t.id==="bad-price"));
      console.log("The impossible-calendar-date trade was skipped:", !DB.trades.some(t=>t.id==="bad-date"));
      console.log("User is told how many trades were skipped:", alerts.some(a=>/3 operaci/.test(a)));
      console.log("RESTORE INVALID TRADES SMOKE OK");
    }catch(e){console.log("ERR2",e.message,e.stack);}},180);
  }catch(e){console.log("ERR1",e.message,e.stack);}},120);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
