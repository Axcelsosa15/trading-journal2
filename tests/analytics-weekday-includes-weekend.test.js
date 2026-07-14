// Regression test: "P&L por día de la semana" on the Analytics page must
// include Saturday/Sunday trades. Previously wdNames only covered Mon-Fri,
// so any weekend trade (the app explicitly supports weekend-trading
// instruments like BTC/ETH crypto futures) silently vanished from the chart
// with no indication data was missing.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
// 2026-06-06 is a Saturday. A +500 BTC winner that day, plus a -100 Monday loser.
const TRADES=[
  {id:"sat1",date:"2026-06-06",time:"10:00",symbol:"BTC",type:"future",side:"long",contracts:1,entry:60000,exit:60500,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:500,account_id:null,tags:[],mae:null,mfe:null},
  {id:"mon1",date:"2026-06-08",time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5400,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:-100,account_id:null,tags:[],mae:null,mfe:null},
];
function makeFrom(tbl){const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data; if(tbl==="trades")data=TRADES; else if(tbl==="user_settings")data={data:{rules:{},checklist:["x"],onboardingDone:true}}; else data=[];
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  click([...d.querySelectorAll(".side button")].find(b=>/Analítica/.test(b.textContent)));
  const titleEl=[...d.querySelectorAll("div")].find(el=>el.textContent.trim()==="P&L por día de la semana" && el.children.length===0);
  const card=titleEl.parentElement;
  const cardText=card.textContent.replace(/\s/g,"");
  console.log("Weekday chart card found:", !!card);
  console.log("Weekday chart includes Sáb label:", /Sáb/.test(cardText));
  console.log("Weekday chart includes Dom label:", /Dom/.test(cardText));
  console.log("Saturday's +$500 BTC winner appears in the chart:", /\+\$500/.test(cardText));
  console.log("Monday's -$100 loser still appears in the chart:", /−\$100/.test(cardText));
  console.log("ANALYTICS WEEKDAY INCLUDES WEEKEND SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},150);
