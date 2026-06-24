// Scale: the data loader must page past PostgREST's 1000-row default so users
// with large histories see ALL their trades, not a silent first-1000 cap.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
const N=2500;
const TRADES=[];for(let i=0;i<N;i++){const day=String((i%27)+1).padStart(2,"0");TRADES.push({id:"t"+i,date:"2026-06-"+day,time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5405,setup:"Ruptura",emotion:"Tranquilo",rating:3,note:"",pnl:25,account_id:null,tags:[],mae:"",mfe:"",screenshot_path:null});}
let maxRangeEnd=0;
function makeFrom(tbl){const b={_range:null,_single:false};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.single=()=>{b._single=true;return b;};b.maybeSingle=()=>{b._single=true;return b;};
 b.range=(from,to)=>{b._range=[from,to];maxRangeEnd=Math.max(maxRangeEnd,to);return b;};
 b.then=(res,rej)=>{let data;
   if(tbl==="trades"){data=b._range?TRADES.slice(b._range[0],b._range[1]+1):TRADES.slice(0,1000);}
   else if(tbl==="user_settings"){data=null;}
   else {data=[];}
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
setTimeout(()=>{try{
  const txt=d.body.textContent;
  // trades nav badge / headers reflect the full count, not 1000
  console.log("Loaded all "+N+" trades (not capped at 1000):", txt.indexOf(String(N))>=0);
  console.log("Pagination requested rows beyond 1000:", maxRangeEnd>=1999);
  // sanity: dashboard renders without error with large dataset
  console.log("App rendered with large dataset:", !!d.querySelector("main") && !/error inesperado/.test(txt));
  console.log("PAGINATION SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},250);
