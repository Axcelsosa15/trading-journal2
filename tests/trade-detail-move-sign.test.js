// Trade-detail drawer bug: the "points moved" caption under the P&L result
// was computed as raw (exit - entry), ignoring trade side. For a short, price
// falling is the winning direction (pnl uses a -1 side multiplier), so a
// winning short showed a "−" move directly under its green "+$..." result,
// and a losing short showed a "+" move under a red "−$..." result — the two
// numbers on screen contradicted each other. The fix flips the move's sign
// by the same side multiplier pnlOf() uses, so the point-move sign always
// agrees with the P&L sign.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
// s1: short, entry 5410 -> exit 5400 (price fell 10pts) => WINNING short, pnl=+50.
// s2: short, entry 5400 -> exit 5410 (price rose 10pts) => LOSING short, pnl=-50.
const SEED=[
  {id:"s1",date:"2026-06-10",time:"10:00",symbol:"MES",type:"future",side:"short",contracts:1,entry:5410,exit:5400,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:50,account_id:null,tags:[],mae:"",mfe:"",screenshot_path:null},
  {id:"s2",date:"2026-06-11",time:"10:00",symbol:"MNQ",type:"future",side:"short",contracts:1,entry:5400,exit:5410,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:-50,account_id:null,tags:[],mae:"",mfe:"",screenshot_path:null},
];
function makeFrom(tbl){const b={};b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data=tbl==="trades"?SEED.slice():(tbl==="user_settings"?null:[]);return Promise.resolve({data,error:null}).then(res,rej);};return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  const row1=[...d.querySelectorAll("main button")].find(b=>b.style.display==="grid"&&/MES/.test(b.textContent));
  click(row1);
  setTimeout(()=>{try{
    const drawer1=d.querySelector(".dc-drawer").textContent;
    console.log("Winning short shows +$50 result:", /\+\$50/.test(drawer1));
    console.log("Winning short shows a '+' points move (not '−'):", /\+10\s*pts/.test(drawer1) && !/−10\s*pts/.test(drawer1));
    click(d.querySelector(".dc-overlay")); // close drawer
    setTimeout(()=>{try{
      const row2=[...d.querySelectorAll("main button")].find(b=>b.style.display==="grid"&&/MNQ/.test(b.textContent));
      click(row2);
      setTimeout(()=>{try{
        const drawer2=d.querySelector(".dc-drawer").textContent;
        console.log("Losing short shows -$50 result:", /−\$50/.test(drawer2));
        console.log("Losing short shows a '−' points move (not '+'):", /−10\s*pts/.test(drawer2) && !/\+10\s*pts/.test(drawer2));
        console.log("TRADE DETAIL MOVE SIGN SMOKE OK");
      }catch(e){console.log("ERR2",e.message,e.stack);}},100);
    }catch(e){console.log("ERR1b",e.message,e.stack);}},80);
  }catch(e){console.log("ERR1",e.message,e.stack);}},100);
}catch(e){console.log("ERR0",e.message,e.stack);}},150);
