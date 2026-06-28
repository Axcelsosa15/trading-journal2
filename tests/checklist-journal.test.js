// Step C: completing the pre-trade checklist auto-saves a diary entry, and the
// journal surfaces a "checklist day vs. non-checklist day" performance connection.
// Boots the app, drives the checklist modal through the DOM, and asserts both the
// persisted journal insert and the rendered connection panel.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};
function pad(n){return n<10?"0"+n:""+n;}
function todayISO(){var d=new Date();return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());}
const TODAY=todayISO();
// Two trades today (net +60, 50% win), two on a past day (net +80) → a real comparison.
const TRADES=[
 {id:"t1",date:TODAY,symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5420,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:100,account_id:null,tags:[],mae:null,mfe:null},
 {id:"t2",date:TODAY,symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5390,setup:"Pullback",emotion:"Ansioso",rating:2,note:"",pnl:-40,account_id:null,tags:[],mae:null,mfe:null},
 {id:"t3",date:"2026-01-05",symbol:"NQ",type:"future",side:"long",contracts:1,entry:19000,exit:19050,setup:"Ruptura",emotion:"Confiado",rating:5,note:"",pnl:50,account_id:null,tags:[],mae:null,mfe:null},
 {id:"t4",date:"2026-01-05",symbol:"NQ",type:"future",side:"long",contracts:1,entry:19000,exit:19030,setup:"Ruptura",emotion:"Confiado",rating:4,note:"",pnl:30,account_id:null,tags:[],mae:null,mfe:null}];
const inserts=[]; // captured journal inserts
function makeFrom(tbl){let op="select",payload=null;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;
 b.insert=r=>{op="insert";payload=r;if(tbl==="journal")inserts.push(r);return b;};
 b.update=r=>{op="update";payload=r;return b;};b.upsert=r=>{op="upsert";payload=r;return b;};b.delete=()=>{op="delete";return b;};
 b.single=()=>{ if(op==="insert"||op==="update") return Promise.resolve({data:Object.assign({id:"new_"+inserts.length},payload),error:null}); return Promise.resolve({data:null,error:null}); };
 b.maybeSingle=()=>Promise.resolve({data:null,error:null});
 b.then=(res,rej)=>{let data; if(op==="select"){data=tbl==="trades"?TRADES:[];} else data=null; return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
function modalRows(){ // checklist question buttons (exclude footer + close)
  const root=d.getElementById("modal-root");
  return [...root.querySelectorAll("button")].filter(b=>{const t=b.textContent.trim();return t&&t!=="Cerrar"&&t!=="Guardar y operar";});
}
function saveButton(){return [...d.getElementById("modal-root").querySelectorAll("button")].find(b=>b.textContent.trim()==="Guardar y operar");}
function completeChecklist(){
  click(d.querySelector('[title="Checklist antes de operar"]'));   // open modal
  modalRows().forEach(click);                                       // tick every item
  const sb=saveButton();
  return sb;
}
const after=(ms,fn)=>setTimeout(fn,ms);
after(140,()=>{try{
  const sb=completeChecklist();
  console.log("Checklist modal opens with items + save button:", modalRows().length>0 && !!sb);
  console.log("Save enabled once every item is ticked:", sb.disabled===false);
  click(sb); // triggers async saveChecklistToJournal
  after(120,()=>{try{
    console.log("One journal entry was inserted:", inserts.length===1);
    const row=inserts[0]||{};
    console.log("Entry is tagged as a checklist + dated today:", /^Checklist pre-operación/.test(row.title||"") && row.date===TODAY);
    console.log("Entry body lists ticked items:", /✓/.test(row.body||""));
    // Go to the diary and confirm the entry + the connection panel render.
    click([...d.querySelectorAll("aside nav button, nav button")].find(b=>/Diario|Diario|Journal/.test(b.textContent)));
    const main=d.querySelector("main").textContent;
    console.log("Diary shows the auto-saved checklist entry:", main.includes("Checklist pre-operación"));
    console.log("Connection panel present:", main.includes("Checklist vs. resultado"));
    console.log("Panel splits checklist vs non-checklist days:", main.includes("Días con checklist") && main.includes("Días sin checklist"));
    // Idempotency: completing again the same day updates, never duplicates.
    const sb2=completeChecklist(); click(sb2);
    after(120,()=>{try{
      console.log("Re-completing the same day does not duplicate:", inserts.length===1);
      console.log("CHECKLIST JOURNAL SMOKE OK");
    }catch(e){console.log("ERR",e.message,e.stack);}});
  }catch(e){console.log("ERR",e.message,e.stack);}});
}catch(e){console.log("ERR",e.message,e.stack);}});
