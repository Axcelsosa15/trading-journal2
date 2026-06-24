const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom;
window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};
const TRADES=[{id:"a",date:"2026-06-20",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5410,setup:"Ruptura",emotion:"Tranquilo",rating:3,note:"",pnl:50,account_id:null,tags:[],mae:"",mfe:""}];
function makeFrom(tbl){let op="select";const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data; if(op==="select"){data=tbl==="trades"?TRADES:(tbl==="user_settings"?null:[]);}else data=null; return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
let cb=null;
window.supabase={createClient:()=>({auth:{onAuthStateChange:f=>{cb=f;return{data:{subscription:{unsubscribe(){}}}};},getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
// pre-seed an outbox for u1
window.localStorage.setItem("bitacora_outbox_u1", JSON.stringify([{table:"trades",row:{},tempId:"tmp_1"}]));
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
setTimeout(()=>{try{
  const cacheBefore=window.localStorage.getItem("bitacora_cache_u1");
  const outboxBefore=window.localStorage.getItem("bitacora_outbox_u1");
  console.log("Cache written after load:", !!cacheBefore);
  console.log("Outbox present before logout:", !!outboxBefore);
  // trigger SIGNED_OUT
  cb("SIGNED_OUT", null);
  setTimeout(()=>{
    const cacheAfter=window.localStorage.getItem("bitacora_cache_u1");
    const outboxAfter=window.localStorage.getItem("bitacora_outbox_u1");
    console.log("Cache cleared on logout:", cacheAfter===null);
    console.log("Outbox cleared on logout:", outboxAfter===null);
    console.log("F05 SMOKE OK");
  },20);
}catch(e){console.log("ERR",e.message,e.stack);}},120);
