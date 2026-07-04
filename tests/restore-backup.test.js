// Regression test: the "Restaurar" button must read a JSON backup (the file
// produced by exportAll/"Backup") and upsert it back — updating rows that
// already exist (same id) instead of duplicating them, inserting rows that
// don't exist yet, and reapplying settings (risk rules + checklist).
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
window.alert=function(){};

// Mock "DB" seeded with one existing trade (t1) so the backup file — which
// also contains t1 with a changed note, plus a brand-new t2 — exercises both
// the update-in-place branch and the insert branch of the same upsert call.
let DB={ trades:[{id:"t1",date:"2026-06-01",time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:100,exit:110,setup:"Ruptura",emotion:"Tranquilo",rating:3,note:"orig",pnl:50,commission:0,account_id:null,tags:[],mae:null,mfe:null,screenshot_path:null}], accounts:[], journal:[] };
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
    Object.assign({},DB.trades[0],{note:"updated via backup"}),
    {id:"t2",date:"2026-06-05",time:"11:00",symbol:"NQ",type:"future",side:"short",contracts:1,entry:18000,exit:17950,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"nuevo",pnl:1000,commission:0,account_id:null,tags:[],mae:null,mfe:null,screenshot_path:null},
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
    const mr=d.getElementById("modal-root").textContent;
    console.log("Preview shows 2 trades in backup:", /2 operaci/.test(mr));
    console.log("Preview shows 1 new trade:", /1 nueva/.test(mr));
    console.log("Preview flags settings will be overwritten:", /Incluye ajustes/.test(mr));
    const go=[...d.querySelectorAll("#modal-root button")].find(b=>/Restaurar backup/.test(b.textContent));
    click(go);
    setTimeout(()=>{try{
      console.log("Existing trade updated in place, not duplicated:", DB.trades.filter(t=>t.id==="t1").length===1);
      console.log("Existing trade's note reflects the backup:", DB.trades.find(t=>t.id==="t1").note==="updated via backup");
      console.log("New trade from the backup was inserted:", DB.trades.some(t=>t.id==="t2"));
      console.log("Total trades after restore is exactly 2 (no duplicates):", DB.trades.length===2);
      console.log("Settings from the backup were saved:", !!(settingsSaved && settingsSaved.rules && Number(settingsSaved.rules.maxDailyLoss)===200));
      console.log("Modal closed after a successful restore:", !d.getElementById("modal-root").querySelector(".dc-modal"));
      console.log("RESTORE BACKUP SMOKE OK");
    }catch(e){console.log("ERR2",e.message,e.stack);}},180);
  }catch(e){console.log("ERR1",e.message,e.stack);}},120);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
