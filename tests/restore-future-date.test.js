// Regression test: runRestore() upserted every trade from a JSON backup
// without validating its date, unlike CSV import (buildImportRow) and manual
// entry (saveTrade), both of which reject future-dated or calendar-invalid
// dates. A hand-edited or corrupted backup file could plant a future-dated
// trade that then pollutes riskStatus(), the calendar view and streaks.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
window.alert=function(){};
let DB={ trades:[], accounts:[], journal:[] };
let settingsSaved=null;
function makeFrom(tbl){let op="select",payload=null,single=false;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>{single=true;return b;};b.maybeSingle=()=>{single=true;return b;};
 b.insert=(r)=>{op="insert";payload=r;return b;};b.update=(r)=>{op="update";payload=r;return b;};
 b.upsert=(r)=>{op="upsert";payload=r;return b;};b.delete=()=>{op="delete";return b;};
 b.then=(res,rej)=>{
   if(tbl==="user_settings"){
     if(op==="upsert"){settingsSaved=payload.data;return Promise.resolve({data:payload,error:null}).then(res,rej);}
     return Promise.resolve({data:settingsSaved?{data:settingsSaved}:null,error:null}).then(res,rej);
   }
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
    {id:"t1",date:"2026-06-01",time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:100,exit:110,setup:"Ruptura",emotion:"Tranquilo",rating:3,note:"válido",pnl:50,commission:0,account_id:null,tags:[],mae:null,mfe:null,screenshot_path:null},
    {id:"t2",date:"2099-01-01",time:"11:00",symbol:"NQ",type:"future",side:"short",contracts:1,entry:18000,exit:17950,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"fecha futura",pnl:1000,commission:0,account_id:null,tags:[],mae:null,mfe:null,screenshot_path:null},
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
      console.log("The past-dated trade was restored:", DB.trades.some(t=>t.id==="t1"));
      console.log("The future-dated trade (2099) was rejected, not restored:", !DB.trades.some(t=>t.id==="t2"));
      console.log("RESTORE FUTURE DATE SMOKE OK");
    }catch(e){console.log("ERR2",e.message,e.stack);}},180);
  }catch(e){console.log("ERR1",e.message,e.stack);}},120);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
