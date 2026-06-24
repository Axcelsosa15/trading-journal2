const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
// controllable online flag
let ONLINE=false;
Object.defineProperty(window.navigator,"onLine",{get:()=>ONLINE,configurable:true});
window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};
let inserts=[];
function makeFrom(tbl){let op="select",row=null;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=r=>{op="insert";row=r;return b;};b.update=r=>{op="update";row=r;return b;};b.upsert=r=>{op="upsert";row=r;return b;};b.delete=()=>{op="delete";return b;};
 b.then=(res,rej)=>{
   if(op==="select" && !ONLINE){ return Promise.reject(new Error("offline")).then(res,rej); }
   let data;
   if(op==="select"){ data=[]; }
   else if(op==="insert"){ inserts.push({tbl,row}); data=Object.assign({id:"real_"+inserts.length,tags:[]},row); }
   else data=null;
   return Promise.resolve({data,error:null}).then(res,rej);
 };
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  // started offline -> offline banner present
  console.log("Offline banner:", /Sin conexión/.test(d.querySelector("main").textContent));
  // create a trade offline via modal
  click([...d.querySelectorAll("header button")].find(b=>/Nueva operación/.test(b.textContent)));
  setTimeout(()=>{
    const mr=d.getElementById("modal-root");
    const set=(type,val)=>{const el=[...mr.querySelectorAll("input")].find(i=>i.getAttribute("type")===type);};
    const inputs=[...mr.querySelectorAll("input")];
    // symbol(text), date, time, contracts(number), entry, exit
    const byType=t=>[...mr.querySelectorAll("input")].filter(i=>i.type===t);
    const nums=byType("number");
    // contracts, entry, exit are the first three number inputs (then mae,mfe)
    nums[0].value="2"; nums[0].dispatchEvent(new window.Event("input",{bubbles:true}));
    nums[1].value="5400"; nums[1].dispatchEvent(new window.Event("input",{bubbles:true}));
    nums[2].value="5410"; nums[2].dispatchEvent(new window.Event("input",{bubbles:true}));
    const save=[...mr.querySelectorAll("button")].find(b=>/Guardar operación/.test(b.textContent));
    click(save);
    setTimeout(()=>{
      const outbox=JSON.parse(window.localStorage.getItem("bitacora_outbox_u1")||"[]");
      const cache=JSON.parse(window.localStorage.getItem("bitacora_cache_u1")||"null");
      console.log("Outbox has queued trade:", outbox.length===1 && outbox[0].table==="trades");
      console.log("Optimistic trade cached:", cache && cache.trades.length===1 && String(cache.trades[0].id).startsWith("tmp_"));
      console.log("No insert hit network while offline:", inserts.length===0);
      // go online -> flush
      ONLINE=true;
      window.dispatchEvent(new window.Event("online"));
      setTimeout(()=>{
        const outbox2=JSON.parse(window.localStorage.getItem("bitacora_outbox_u1")||"[]");
        console.log("Flushed on reconnect: inserts=",inserts.length," outboxEmpty=",outbox2.length===0);
        console.log("Banner cleared online:", !/Sin conexión/.test(d.querySelector("main").textContent));
        console.log("OFFLINE SMOKE OK");
      },60);
    },40);
  },40);
}catch(e){console.log("ERR",e.message,e.stack);}},120);
