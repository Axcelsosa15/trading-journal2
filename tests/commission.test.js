const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x"; window.URL.revokeObjectURL=()=>{};
window.HTMLAnchorElement.prototype.click=function(){};
let inserted=null;
function makeFrom(tbl){let op="select",row=null;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=r=>{op="insert";row=r;return b;};b.update=r=>{op="update";row=r;return b;};b.upsert=r=>{op="upsert";row=r;return b;};b.delete=()=>{op="delete";return b;};
 b.then=res=>{let data;
   if(op==="select"){ data=[]; }
   else if(op==="insert"){ if(tbl==="trades") inserted=row; data=Object.assign({id:"new",tags:[]},row); }
   else data=null;
   return Promise.resolve({data,error:null}).then(res);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>{window.__cb=cb;return{data:{subscription:{unsubscribe(){}}}};},getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  // sidebar no longer shows a fake hardcoded starting balance
  const side=d.querySelector("aside").textContent;
  console.log("No fake Cuenta-Sim label:", !/Cuenta · Sim/.test(side));
  console.log("Sidebar shows real P&L acumulado with no accounts:", /P&L acumulado/.test(side));

  // open "Nueva operación" — required fields still empty -> Guardar must be disabled
  click([...d.querySelectorAll("header button")].find(b=>/Nueva operación/.test(b.textContent)));
  let mr=d.getElementById("modal-root");
  let saveBtn=[...mr.querySelectorAll("button")].find(b=>/Guardar operación/.test(b.textContent));
  console.log("Save disabled with empty entry/exit:", saveBtn.disabled===true);

  // fill entry/exit/contracts + a commission, check the net P&L preview
  const nums=[...mr.querySelectorAll("input[type=number]")];
  const byPlaceholder=(ph)=>[...mr.querySelectorAll("input")].find(i=>i.placeholder===ph);
  nums[0].value="2"; nums[0].dispatchEvent(new window.Event("input",{bubbles:true})); // contracts
  nums[1].value="5400"; nums[1].dispatchEvent(new window.Event("input",{bubbles:true})); // entry
  nums[2].value="5410"; nums[2].dispatchEvent(new window.Event("input",{bubbles:true})); // exit
  const commissionInput=[...mr.querySelectorAll("input[type=number]")].find(i=>i.step==="0.01" && i.min==="0");
  commissionInput.value="4.5"; commissionInput.dispatchEvent(new window.Event("input",{bubbles:true}));
  mr=d.getElementById("modal-root");
  const preview=mr.textContent;
  // MES point value = 5, contracts=2, +10pts move => gross = 100; net = 100 - 4.5 = 95.5 -> rounds to $96 in the pill
  console.log("Preview label mentions comisiones:", /tras comisiones/.test(preview));
  console.log("Preview shows net (not gross) amount:", /\+\$96(?!\d)/.test(preview) || /\+\$95(?!\d)/.test(preview));

  saveBtn=[...mr.querySelectorAll("button")].find(b=>/Guardar operación/.test(b.textContent));
  console.log("Save enabled once valid:", saveBtn.disabled===false);
  click(saveBtn);
  setTimeout(()=>{
    console.log("Inserted row carries commission:", inserted && Number(inserted.commission)===4.5);
    console.log("Inserted pnl is net of commission:", inserted && Number(inserted.pnl)===95.5);
    console.log("COMMISSION SMOKE OK");
  },30);
}catch(e){console.log("ERR",e.message,e.stack);}},120);
