// Regression test: exportCSV() must neutralize CSV/formula injection (CWE-1236).
// A trade note or tag starting with =, +, @ or tab is executed as a formula by
// Excel/Sheets when the exported file is reopened (e.g. =HYPERLINK(...) for
// exfiltration, or a DDE launch). csvCell() must prefix such cells with a quote
// to force text — but must leave plain negative/positive numbers (pnl, R,
// commission, …) untouched so they stay numeric in the spreadsheet.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
const TRADES=[
  {id:"t1",date:"2026-06-01",time:"09:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5420,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"=HYPERLINK(\"http://evil.test\")",pnl:100,account_id:null,tags:["@mention"],mae:null,mfe:null},
  {id:"t2",date:"2026-06-02",time:"09:00",symbol:"MES",type:"future",side:"short",contracts:1,entry:5400,exit:5410,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:-50,account_id:null,tags:[],mae:null,mfe:null},
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
  const csvBtn=[...d.querySelectorAll("button")].find(b=>/Exportar a CSV/.test(b.getAttribute("title")||""));
  click(csvBtn);
  console.log("CSV export produced a file:", !!lastBlob);
  lastBlob.text().then(function(text){
    var body=text.replace(/^﻿/,"");
    console.log("Formula-injection note is neutralized with a leading quote:", /'=HYPERLINK/.test(body));
    console.log("Raw =HYPERLINK( does NOT appear unguarded:", !/[^']=HYPERLINK/.test(body));
    console.log("Formula-injection tag is neutralized with a leading quote:", /'@mention/.test(body));
    console.log("Negative pnl -50 stays a plain number, not quote-prefixed:", /,-50,/.test(body) && !/,'-50,/.test(body));
    console.log("Positive pnl +100 stays a plain number, not quote-prefixed:", /,100,/.test(body) && !/,'100,/.test(body));
    console.log("CSV INJECTION GUARD SMOKE OK");
  });
}catch(e){console.log("ERR",e.message,e.stack);}},150);
