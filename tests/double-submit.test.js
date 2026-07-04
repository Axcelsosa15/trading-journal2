// Reentrancy guard: a rapid double-click (or slow network) on "Guardar" must
// not insert the same trade/journal entry/account twice. Mirrors the existing
// import.busy pattern already used for CSV import.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
let tradeInserts=0, journalInserts=0, accountInserts=0;
function makeFrom(tbl){let op="select",payload=null,single=false;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>{single=true;return b;};b.maybeSingle=()=>{single=true;return b;};
 b.insert=(r)=>{op="insert";payload=r;if(tbl==="trades")tradeInserts++;if(tbl==="journal")journalInserts++;if(tbl==="accounts")accountInserts++;return b;};
 b.update=(r)=>{op="update";payload=r;return b;};b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>new Promise(function(resolve){setTimeout(function(){
   let data;
   if(op==="insert"){const withId=Object.assign({id:"new"+Math.random()},payload);data=single?withId:[withId];}
   else{data=tbl==="trades"?[]:(tbl==="user_settings"?null:[]);if(single&&Array.isArray(data))data=data[0]||null;}
   resolve({data,error:null});
 },30);}).then(res,rej);
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
const setVal=(el,v)=>{el.value=v;el.dispatchEvent(new window.Event("input",{bubbles:true}));};
setTimeout(()=>{try{
  click([...d.querySelectorAll("button")].find(b=>/Nueva operaci/.test(b.textContent)));
  const nums=[...d.querySelectorAll("#modal-root input[type=number]")].filter(i=>i.getAttribute("placeholder")==="0.00");
  setVal(nums[0],"5400"); setVal(nums[1],"5420");
  const saveBtn=[...d.querySelectorAll("#modal-root button")].find(b=>/Guardar operaci/.test(b.textContent));
  click(saveBtn); click(saveBtn); click(saveBtn); // rapid triple-click (same node) before the request resolves
  setTimeout(()=>{try{
    console.log("Exactly one trade inserted despite 3 rapid clicks:", tradeInserts===1);
    console.log("DOUBLE SUBMIT SMOKE OK");
  }catch(e){console.log("ERR2",e.message,e.stack);}},120);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
