const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x"; window.URL.revokeObjectURL=()=>{};
let inserted=null;
function makeFrom(tbl){let op="select",payload=null;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=(r)=>{op="insert";payload=r;return b;};b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data;
   if(op==="insert"){inserted=payload;data=Object.assign({id:"t1",tags:[]},payload);}
   else{data=tbl==="user_settings"?null:[];}
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
const setNum=(el,v)=>{el.value=String(v);el.dispatchEvent(new window.Event("input",{bubbles:true}));};
setTimeout(()=>{try{
  click([...d.querySelectorAll("header button")].find(b=>/Nueva operación/.test(b.textContent)));
  setTimeout(()=>{try{
    const mr=d.getElementById("modal-root");
    const nums=[...mr.querySelectorAll("input[type=number]")];
    // order: contracts, entry, exit, mae, mfe, commission
    console.log("Commission input present:", nums.length===6);
    setNum(nums[0],2);   // contracts
    setNum(nums[1],5400); // entry
    setNum(nums[2],5410); // exit
    setNum(nums[5],20);  // commission
    // MES long 2 @ +10pts * $5/pt = +$100 gross, minus $20 commission = $80 net
    const preview=mr.textContent;
    console.log("Net preview shown (+$80):", /P&L neto estimado\+\$80/.test(preview));
    console.log("Gross breakdown shown (Bruto +\\$100):", /Bruto \+\$100/.test(preview) && /comisión \$20/.test(preview));
    const save=[...mr.querySelectorAll("button")].find(b=>/Guardar operación/.test(b.textContent));
    click(save);
    setTimeout(()=>{try{
      console.log("Saved trade has commission=20:", inserted && inserted.commission===20);
      console.log("Saved trade pnl is net (80):", inserted && inserted.pnl===80);
      // Estadísticas view surfaces gross-vs-net split
      click([...d.querySelectorAll("aside nav button")].find(b=>/Estad/.test(b.textContent)));
      const sv=d.querySelector("main").textContent;
      console.log("Stats show P&L antes de comisiones:", /P&L antes de comisiones/.test(sv) && /\+\$100/.test(sv));
      console.log("Stats show Comisiones totales:", /Comisiones totales/.test(sv) && /−\$20|-\$20/.test(sv));
      console.log("Stats P&L neto still correct (+$80):", /P&L neto/.test(sv) && /\+\$80/.test(sv));
      console.log("COMMISSION SMOKE OK");
    }catch(e){console.log("ERR3",e.message,e.stack);}},60);
  }catch(e){console.log("ERR2",e.message,e.stack);}},60);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
