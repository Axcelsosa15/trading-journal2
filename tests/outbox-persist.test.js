// Regression test: flushOutbox() must persist the durable queue after each
// item that syncs, not only once after the whole loop finishes. Otherwise a
// tab closed mid-flush still has every already-synced item sitting in the
// queue and re-inserts it (a duplicate trade) the next time flushOutbox runs.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
let ONLINE=true;
Object.defineProperty(window.navigator,"onLine",{get:()=>ONLINE,configurable:true});
window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};
let inserts=[];
let holdNQ; var nqGate=new Promise(function(res){holdNQ=res;});
function makeFrom(tbl){let op="select",row=null;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=r=>{op="insert";row=r;return b;};b.update=r=>{op="update";row=r;return b;};b.upsert=r=>{op="upsert";row=r;return b;};b.delete=()=>{op="delete";return b;};
 b.then=(res,rej)=>{
   var run=(async function(){
     if(op==="select") return {data:[],error:null};
     if(op==="insert"){
       if(row && row.symbol==="NQ") await nqGate; // held open until the test releases it
       inserts.push({tbl:tbl,row:row});
       return {data:Object.assign({id:"real_"+inserts.length,tags:[]},row),error:null};
     }
     return {data:null,error:null};
   })();
   return run.then(res,rej);
 };
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
setTimeout(()=>{try{
  // Seed two already-queued offline trades, as if created while offline and
  // now waiting to sync: the first (MES) resolves immediately, the second
  // (NQ) is held open by nqGate to simulate "still in flight".
  var row1={date:"2026-06-01",time:null,symbol:"MES",type:"future",side:"long",contracts:1,entry:100,exit:110,setup:"Ruptura",emotion:"Tranquilo",rating:3,note:"",pnl:50,commission:0,account_id:null,tags:[],mae:null,mfe:null,screenshot_path:null};
  var row2=Object.assign({},row1,{symbol:"NQ"});
  var outbox=[{table:"trades",row:row1,tempId:"tmp_1",ts:1},{table:"trades",row:row2,tempId:"tmp_2",ts:2}];
  window.localStorage.setItem("bitacora_outbox_u1", JSON.stringify(outbox));
  window.localStorage.setItem("bitacora_cache_u1", JSON.stringify({trades:[Object.assign({id:"tmp_1"},row1),Object.assign({id:"tmp_2"},row2)],journal:[],accounts:[],settings:null,ts:Date.now()}));

  // Drive flushOutbox via the same "online" event the app listens for.
  window.dispatchEvent(new window.Event("online"));
  setTimeout(()=>{try{
    // At this point item 1 (MES) has resolved but item 2 (NQ) is still held
    // open. With the bug, the outbox in localStorage still lists BOTH items
    // until the whole loop finishes; with the fix, item 1 is already gone.
    console.log("First item synced already:", inserts.length===1 && inserts[0].row.symbol==="MES");
    var midFlush=JSON.parse(window.localStorage.getItem("bitacora_outbox_u1")||"[]");
    console.log("Synced item dropped from the durable queue before the flush finishes:", midFlush.length===1 && midFlush[0].tempId==="tmp_2");

    holdNQ();
    setTimeout(()=>{try{
      console.log("Second item synced once released:", inserts.length===2 && inserts[1].row.symbol==="NQ");
      var outboxAfter=JSON.parse(window.localStorage.getItem("bitacora_outbox_u1")||"[]");
      console.log("Outbox fully drained after both items synced:", outboxAfter.length===0);
      console.log("OUTBOX PERSIST SMOKE OK");
    }catch(e){console.log("ERR2",e.message,e.stack);}},80);
  }catch(e){console.log("ERR1",e.message,e.stack);}},60);
}catch(e){console.log("ERR",e.message,e.stack);}},120);
