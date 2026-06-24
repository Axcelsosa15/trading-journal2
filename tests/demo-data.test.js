// Demo data + danger-zone wipe: seeding inserts an account + trades + journal,
// and "Borrar todos los datos" deletes all three tables for the user.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
window.confirm=()=>true; window.prompt=()=>"BORRAR"; const alerts=[]; window.alert=(m)=>alerts.push(String(m));
let idc=0; const inserted={trades:0,journal:0,accounts:0}; const deleted=[]; const seededTradeRows=[];
function withIds(rows){return (Array.isArray(rows)?rows:[rows]).map(r=>Object.assign({},r,{id:"id"+(++idc)}));}
function makeFrom(tbl){
  const b={_mode:"read",_rows:null};
  b.select=()=>b; b.order=()=>b; b.eq=()=>b;
  b.insert=(rows)=>{b._mode="insert";b._rows=rows;inserted[tbl]+=Array.isArray(rows)?rows.length:1;if(tbl==="trades")(Array.isArray(rows)?rows:[rows]).forEach(r=>seededTradeRows.push(r));return b;};
  b.delete=()=>{b._mode="delete";deleted.push(tbl);return b;};
  b.single=()=>Promise.resolve({data:b._mode==="insert"?withIds(b._rows)[0]:null,error:null});
  b.maybeSingle=()=>Promise.resolve({data:null,error:null});
  b.then=(resolve,reject)=>{let r;
    if(b._mode==="insert")r={data:withIds(b._rows),error:null};
    else if(b._mode==="delete")r={error:null};
    else r={data:[],error:null};
    return Promise.resolve(r).then(resolve,reject);};
  return b; // note: no .range -> fetchAll uses single-fetch path
}
const storage={from:()=>({list:async()=>({data:[],error:null}),remove:async()=>({data:[],error:null})})};
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom,storage})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
function btn(text){return [...d.querySelectorAll("button")].find(b=>b.textContent.replace(/\s+/g," ").trim().indexOf(text)>=0);}
setTimeout(()=>{
  const nav=btn("Ajustes"); if(nav)nav.click();
  setTimeout(()=>{
    const seed=btn("Cargar datos de ejemplo");
    console.log("Settings shows seed + wipe buttons:", !!seed && !!btn("Borrar todos los datos"));
    if(seed)seed.click();
    setTimeout(()=>{
      console.log("Seed inserted 1 demo account:", inserted.accounts===1);
      console.log("Seed inserted trades (>0):", inserted.trades>0);
      console.log("Seed inserted 8 journal entries:", inserted.journal===8);
      console.log("Seeded trades all have finite pnl:", seededTradeRows.length>0 && seededTradeRows.every(r=>typeof r.pnl==="number"&&isFinite(r.pnl)));
      console.log("Seed reported success:", alerts.some(a=>/operaciones/.test(a)));
      const wipe=btn("Borrar todos los datos"); if(wipe)wipe.click();
      setTimeout(()=>{
        console.log("Wipe deleted trades, journal and accounts:", deleted.indexOf("trades")>=0&&deleted.indexOf("journal")>=0&&deleted.indexOf("accounts")>=0);
        console.log("Wipe reported success:", alerts.some(a=>/eliminaron/.test(a)));
        console.log("DEMO DATA SMOKE OK");
      },200);
    },250);
  },80);
},120);
