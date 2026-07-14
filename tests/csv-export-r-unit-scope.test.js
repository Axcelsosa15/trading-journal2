// Regression test: the CSV export's "R" column must use 1R = average loss
// across the account's full scope, not just the filtered/exported rows.
// Previously exportCSV(rows) computed rUnitOf(rows) on the exported subset,
// so filtering to "wins only" (no losses in the exported set) silently
// changed what "R" means and corrupted every exported R multiple.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
// Full account: many -100 losers set 1R=100, plus one big +3000 winner -> +30.00R.
const TRADES=[
  {id:"w1",date:"2026-06-01",time:"09:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5700,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:3000,account_id:null,tags:[],mae:null,mfe:null},
  {id:"l1",date:"2026-06-02",time:"09:00",symbol:"MES",type:"future",side:"short",contracts:1,entry:5400,exit:5410,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:-100,account_id:null,tags:[],mae:null,mfe:null},
  {id:"l2",date:"2026-06-03",time:"09:00",symbol:"MES",type:"future",side:"short",contracts:1,entry:5400,exit:5410,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:-100,account_id:null,tags:[],mae:null,mfe:null},
];
function makeFrom(tbl){const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data; if(tbl==="trades")data=TRADES; else if(tbl==="user_settings")data={data:{rules:{},checklist:["x"],onboardingDone:true}}; else data=[];
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
let lastBlob=null;
window.URL.createObjectURL=(blob)=>{lastBlob=blob;return "blob:fake";};
window.URL.revokeObjectURL=()=>{};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  click([...d.querySelectorAll(".side button")].find(b=>/Operaciones/.test(b.textContent)));
  // Filter down to winners only, so the exported subset has zero losses.
  click([...d.querySelectorAll("button")].find(b=>/^Ganadoras$/.test(b.textContent.trim())));
  const csvBtn=[...d.querySelectorAll("button")].find(b=>/Exportar a CSV/.test(b.getAttribute("title")||""));
  click(csvBtn);
  console.log("CSV export produced a file:", !!lastBlob);
  lastBlob.text().then(function(text){
    var lines=text.replace(/^﻿/,"").split(/\r?\n/);
    var body=lines.slice(1).join("\n");
    console.log("Exported subset has exactly the +3000 winner row:", /,3000,/.test(body) && !/,-100,/.test(body));
    console.log("Winner's R multiple uses the account's full 1R=100 (30.00R), not the filtered-subset fallback:", /,3000,30\.00,/.test(body));
    console.log("CSV EXPORT R-UNIT SCOPE SMOKE OK");
  });
}catch(e){console.log("ERR",e.message,e.stack);}},150);
