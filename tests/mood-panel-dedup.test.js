// Regression test: the "Ánimo vs. resultado" panel in Diario grouped a day's
// P&L by journal mood, but iterated per JOURNAL ENTRY rather than per unique
// date. Two journal entries logged for the same date (e.g. a quick note plus
// a full entry, each with a different mood) made that day's P&L get added in
// full to BOTH mood buckets — double-counting the same trades' P&L across
// contradictory moods instead of counting the day once.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};
// Date A: one trade netting +400, logged twice in the journal with two different moods.
// Date B: one trade netting +100, logged once with a third mood (control, so the
// panel has >=2 mood categories and actually renders).
const TRADES=[
  {id:"t1",date:"2026-06-10",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5440,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:400,account_id:null,tags:[],mae:null,mfe:null},
  {id:"t2",date:"2026-06-11",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5410,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:100,account_id:null,tags:[],mae:null,mfe:null},
];
const JOURNAL=[
  {id:"j1",date:"2026-06-10",mood:"Disciplinado",title:"Nota rápida",body:"",lesson:""},
  {id:"j2",date:"2026-06-10",mood:"Frustrado",title:"Entrada completa",body:"",lesson:""},
  {id:"j3",date:"2026-06-11",mood:"Neutral",title:"Entrada",body:"",lesson:""},
];
function makeFrom(tbl){const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data; if(tbl==="trades")data=TRADES; else if(tbl==="journal")data=JOURNAL; else if(tbl==="user_settings")data={data:{rules:{},checklist:["x"],onboardingDone:true}}; else data=[];
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  click([...d.querySelectorAll("aside nav button, nav button")].find(b=>/Diario/.test(b.textContent)));
  const main=d.querySelector("main").textContent;
  console.log("Diario view rendered with mood panel:", main.includes("Ánimo vs. resultado"));
  // The mood panel itself is the div with exactly [title, subtitle, svg] children —
  // isolate it from the journal-entry cards below (which legitimately repeat each
  // entry's day P&L per entry, and would otherwise inflate the count).
  const panel=[...d.querySelectorAll("div")].find(el=>el.children.length===3 && el.children[0].textContent==="Ánimo vs. resultado");
  console.log("Mood panel isolated:", !!panel);
  const panelText=panel?panel.textContent:"";
  var matches400=(panelText.match(/\+\$400/g)||[]).length;
  console.log("+$400 (date A's day P&L) appears exactly once in the panel, not once per mood logged that day:", matches400===1);
  console.log("Panel does not render a separate 'Frustrado' bar for the same duplicated day:", !panelText.includes("Frustrado"));
  console.log("+$100 (date B's day P&L) still appears for the control mood:", /\+\$100/.test(panelText) && panelText.includes("Neutral"));
  console.log("MOOD PANEL DEDUP SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},150);
