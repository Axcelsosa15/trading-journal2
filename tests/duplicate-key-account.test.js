// Regression test: tradeDupKey() ignored account_id, so mirroring the same
// fill across two different accounts (common for prop-firm traders running
// several evaluations in parallel) was flagged as a duplicate — while a real
// duplicate within the SAME account must still be caught.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
function pad(n){return n<10?"0"+n:""+n;}
var now=new Date();
var TODAY=now.getFullYear()+"-"+pad(now.getMonth()+1)+"-"+pad(now.getDate());
let trades=[{id:"existing1",date:TODAY,time:null,symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5410,setup:"Ruptura",emotion:"Tranquilo",rating:3,note:"",pnl:50,commission:0,account_id:"acc1",tags:[],mae:null,mfe:null,screenshot_path:null}];
const ACCOUNTS=[
  {id:"acc1",name:"Eval Account 1",kind:"fondeo",firm:"",balance:50000,currency:"USD",phase:"",status:"activa",profit_target:"",max_drawdown:"",notes:""},
  {id:"acc2",name:"Eval Account 2",kind:"fondeo",firm:"",balance:50000,currency:"USD",phase:"",status:"activa",profit_target:"",max_drawdown:"",notes:""},
];
let tradeInserts=0;
function makeFrom(tbl){let op="select",payload=null;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=(r)=>{op="insert";payload=r;return b;};b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data;
   if(tbl==="trades"&&op==="select"){data=trades;}
   else if(tbl==="accounts"&&op==="select"){data=ACCOUNTS;}
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

function openModalAndFillDup(acctId){
  click([...d.querySelectorAll("button")].find(b=>/Nueva operaci/.test(b.textContent)));
  const nums=[...d.querySelectorAll("#modal-root input[type=number]")].filter(i=>i.getAttribute("placeholder")==="0.00");
  setVal(nums[0],"5400"); setVal(nums[1],"5410"); // matches existing1: MES/long/1/5400/5410, same default date
  const cuentaLabel=[...d.querySelectorAll("#modal-root label")].find(l=>l.querySelector("span")&&l.querySelector("span").textContent==="Cuenta");
  const acctSelect=cuentaLabel&&cuentaLabel.querySelector("select");
  if(acctSelect){acctSelect.value=acctId;acctSelect.dispatchEvent(new window.Event("change",{bubbles:true}));}
  return { saveBtn:[...d.querySelectorAll("#modal-root button")].find(b=>/Guardar operaci/.test(b.textContent)), acctSelect };
}

setTimeout(()=>{try{
  // Same account as the existing trade -> must still prompt as a real duplicate.
  let confirmCalls=[];
  window.confirm=(msg)=>{confirmCalls.push(msg);return false;};
  const m1=openModalAndFillDup("acc1");
  console.log("Account selector present with both accounts:", !!m1.acctSelect && /Eval Account 1/.test(m1.acctSelect.parentElement.textContent) && /Eval Account 2/.test(m1.acctSelect.parentElement.textContent));
  click(m1.saveBtn);
  setTimeout(()=>{try{
    console.log("Same-account duplicate still prompts for confirmation:", confirmCalls.length===1);
    // Different account -> a legitimate mirrored fill, must NOT be flagged.
    confirmCalls=[];
    const startCount=trades.length;
    const m2=openModalAndFillDup("acc2");
    click(m2.saveBtn);
    setTimeout(()=>{try{
      console.log("Different-account mirror does not prompt as a duplicate:", confirmCalls.length===0);
      console.log("Different-account mirror is saved without needing confirmation:", trades.length===startCount+1);
      console.log("DUPLICATE KEY ACCOUNT SMOKE OK");
    }catch(e){console.log("ERR3",e.message,e.stack);}},150);
  }catch(e){console.log("ERR2",e.message,e.stack);}},150);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
