// Manual trade entry must reuse the same identity check CSV import already
// applies (tradeDupKey): saving a second trade with the same date/symbol/
// side/contracts/entry/exit as one already on file should ask for
// confirmation instead of silently doubling the P&L.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
function pad(n){return n<10?"0"+n:""+n;}
var now=new Date();
var TODAY=now.getFullYear()+"-"+pad(now.getMonth()+1)+"-"+pad(now.getDate());
let trades=[{id:"existing1",date:TODAY,time:null,symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5410,setup:"Ruptura",emotion:"Tranquilo",rating:3,note:"",pnl:50,commission:0,account_id:null,tags:[],mae:null,mfe:null,screenshot_path:null}];
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

function openModalAndFillDup(){
  click([...d.querySelectorAll("button")].find(b=>/Nueva operaci/.test(b.textContent)));
  const nums=[...d.querySelectorAll("#modal-root input[type=number]")].filter(i=>i.getAttribute("placeholder")==="0.00");
  setVal(nums[0],"5400"); setVal(nums[1],"5410"); // matches the existing trade: MES/long/1/5400/5410, same default date
  return [...d.querySelectorAll("#modal-root button")].find(b=>/Guardar operaci/.test(b.textContent));
}

setTimeout(()=>{try{
  const startCount=trades.length;
  // First: confirm() rejected -> save must be aborted, no insert.
  let confirmCalls=[];
  window.confirm=(msg)=>{confirmCalls.push(msg);return false;};
  const saveBtn1=openModalAndFillDup();
  click(saveBtn1);
  setTimeout(()=>{try{
    console.log("Duplicate prompts for confirmation:", confirmCalls.length===1);
    console.log("Declining the prompt does not insert a duplicate:", trades.length===startCount);
    // Second: confirm() accepted -> save proceeds, duplicate is inserted (user's call).
    window.confirm=()=>true;
    const saveBtn2=[...d.querySelectorAll("#modal-root button")].find(b=>/Guardar operaci/.test(b.textContent));
    click(saveBtn2);
    setTimeout(()=>{try{
      console.log("Confirming the prompt does insert the duplicate:", trades.length===startCount+1);
      console.log("MANUAL DUPLICATE GUARD SMOKE OK");
    }catch(e){console.log("ERR3",e.message,e.stack);}},120);
  }catch(e){console.log("ERR2",e.message,e.stack);}},150);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
