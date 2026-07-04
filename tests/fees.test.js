const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};
// Supabase mock: trades start empty; insert echoes rows back with ids (so pnl/fees round-trip through coerceTrade).
function makeFrom(tbl){let op="select",payload=null;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=(r)=>{op="insert";payload=r;return b;};b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data;
   if(op==="insert"){data=Object.assign({id:"t1",tags:[]},payload);}
   else{data=tbl==="user_settings"?null:[];}
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  // Create MES long trade: entry 5400, exit 5410 (+10pts * $5 * 1 = +$50 gross), fees $20 -> net +$30.
  click([...d.querySelectorAll("header button")].find(b=>/Nueva operación/.test(b.textContent)));
  setTimeout(()=>{try{
    const mr=d.getElementById("modal-root");
    const nums=[...mr.querySelectorAll("input")].filter(i=>i.type==="number");
    console.log("Form has 6 number inputs (contracts,entry,exit,fees,mae,mfe):", nums.length===6);
    nums[1].value="5400"; nums[1].dispatchEvent(new window.Event("input",{bubbles:true}));
    nums[2].value="5410"; nums[2].dispatchEvent(new window.Event("input",{bubbles:true}));
    nums[3].value="20"; nums[3].dispatchEvent(new window.Event("input",{bubbles:true}));
    const preview=mr.textContent;
    console.log("Live preview shows net (not gross):", /\+\$30(?!\d)/.test(preview) && !/\+\$50(?!\d)/.test(preview));
    const save=[...mr.querySelectorAll("button")].find(b=>/Guardar operación/.test(b.textContent));
    click(save);
    setTimeout(()=>{try{
      console.log("Modal closed after save:", d.getElementById("modal-root").children.length===0);
      const opsText=d.querySelector("main").textContent;
      console.log("Trade list shows net P&L +$30:", /\+\$30(?!\d)/.test(opsText));
      // Negative/garbage fees must not validate as save-able on a fresh draft.
      click([...d.querySelectorAll("header button")].find(b=>/Nueva operación/.test(b.textContent)));
      setTimeout(()=>{try{
        const mr2=d.getElementById("modal-root");
        const nums2=[...mr2.querySelectorAll("input")].filter(i=>i.type==="number");
        nums2[1].value="100"; nums2[1].dispatchEvent(new window.Event("input",{bubbles:true}));
        nums2[2].value="110"; nums2[2].dispatchEvent(new window.Event("input",{bubbles:true}));
        nums2[3].value="-5"; nums2[3].dispatchEvent(new window.Event("input",{bubbles:true}));
        const save2=[...mr2.querySelectorAll("button")].find(b=>/Guardar operación/.test(b.textContent));
        console.log("Negative fees keeps save disabled:", /cursor:\s*not-allowed/.test(save2.getAttribute("style")||""));
        click([...mr2.querySelectorAll("button")].find(b=>/Cancelar/.test(b.textContent)));
        // Stats view: gross P&L and total fees are surfaced separately from net.
        click([...d.querySelectorAll("aside nav button")].find(b=>/Estadísticas/.test(b.textContent)));
        setTimeout(()=>{try{
          const statsText=d.querySelector("main").textContent;
          console.log("Stats show P&L bruto (+$50):", /P&L bruto/.test(statsText) && /\+\$50/.test(statsText));
          console.log("Stats show Comisiones ($20):", /Comisiones/.test(statsText) && /\$20/.test(statsText));
          console.log("FEES SMOKE OK");
        }catch(e){console.log("ERR4",e.message,e.stack);}},80);
      }catch(e){console.log("ERR3",e.message,e.stack);}},60);
    }catch(e){console.log("ERR2",e.message,e.stack);}},60);
  }catch(e){console.log("ERR1",e.message,e.stack);}},60);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
