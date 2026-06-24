const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true});
const {window}=dom; const d=window.document;
window.URL.createObjectURL=()=>"blob:x";window.URL.revokeObjectURL=()=>{};
const TRADES=[
 {id:"t1",date:"2026-06-18",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5420,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"",pnl:100,account_id:null,tags:[],mae:"",mfe:""},
 {id:"t2",date:"2026-06-19",symbol:"NQ",type:"future",side:"long",contracts:1,entry:19000,exit:18950,setup:"Pullback",emotion:"FOMO",rating:2,note:"",pnl:-200,account_id:null,tags:[],mae:"",mfe:""}];
const JOURNAL=[
 {id:"j1",date:"2026-06-18",mood:"Disciplinado",title:"Sesión sólida",body:"Seguí el plan al pie de la letra",lesson:"Esperar la confirmación funciona"},
 {id:"j2",date:"2026-06-19",mood:"Frustrado",title:"Overtrading otra vez",body:"Entré por aburrimiento",lesson:"No operar sin setup"}];
let updated=null, deleted=null;
function makeFrom(tbl){let op="select",row=null,eqid=null;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=(k,v)=>{eqid=v;return b;};b.single=()=>b;b.maybeSingle=()=>b;
 b.insert=r=>{op="insert";row=r;return b;};b.update=r=>{op="update";row=r;return b;};b.upsert=r=>{op="upsert";row=r;return b;};b.delete=()=>{op="delete";return b;};
 b.then=(res,rej)=>{let data;
   if(op==="select"){data=tbl==="trades"?TRADES:(tbl==="journal"?JOURNAL:(tbl==="user_settings"?null:[]));}
   else if(op==="update"){updated={tbl,row,id:eqid};data=Object.assign({id:eqid},row);}
   else if(op==="delete"){deleted={tbl,id:eqid};data=null;}
   else data=null;
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
window.confirm=()=>true;
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  click([...d.querySelectorAll("aside nav button")].find(b=>/Diario/.test(b.textContent)));
  const main=d.querySelector("main");
  console.log("Search box:", !!main.querySelector("input[placeholder*='Buscar']"));
  console.log("Mood-vs-result panel:", /Ánimo vs\. resultado/.test(main.textContent));
  console.log("Lessons library:", /Biblioteca de lecciones/.test(main.textContent));
  console.log("Day trades chips:", /op\. ese día/.test(main.textContent));
  // live search filter (no re-render): filter to 'overtrading'
  const search=main.querySelector("input[placeholder*='Buscar']");
  search.focus(); // a real user is typing; the filter must not steal focus (no re-render)
  search.value="overtrading"; search.dispatchEvent(new window.Event("input",{bubbles:true}));
  // count cards visible
  const cards=[...main.querySelectorAll("div")].filter(el=>/Overtrading otra vez|Sesión sólida/.test(el.textContent)&&el.style.borderRadius==="14px");
  // simpler: check the two title nodes' visibility via closest card display
  const titleNodes=[...main.querySelectorAll("div")].filter(el=>el.textContent==="Overtrading otra vez"||el.textContent==="Sesión sólida");
  const visible=titleNodes.filter(t=>{let p=t;while(p&&p!==main){if(p.style&&p.style.display==="none")return false;p=p.parentElement;}return true;});
  console.log("Live search shows only matching entries:", visible.length===1 && visible[0].textContent==="Overtrading otra vez");
  console.log("Focus preserved (active is search):", d.activeElement===search);
  // edit an entry
  const editBtns=[...main.querySelectorAll("button[title='Editar entrada']")];
  click(editBtns[0]);
  setTimeout(()=>{
    const mr=d.getElementById("modal-root");
    console.log("Edit modal opened:", /Editar entrada de diario/.test(mr.textContent), "| has Eliminar:", /Eliminar/.test(mr.textContent));
    const titleInput=[...mr.querySelectorAll("input")].find(i=>i.value==="Sesión sólida"||i.value==="Overtrading otra vez");
    titleInput.value="Editado"; titleInput.dispatchEvent(new window.Event("input",{bubbles:true}));
    click([...mr.querySelectorAll("button")].find(b=>/Guardar cambios/.test(b.textContent)));
    setTimeout(()=>{
      console.log("Update sent to journal:", updated&&updated.tbl==="journal"&&updated.row.title==="Editado");
      // delete via open edit then Eliminar
      click([...d.querySelectorAll("main button[title='Editar entrada']")][0]);
      setTimeout(()=>{
        const mr2=d.getElementById("modal-root");
        click([...mr2.querySelectorAll("button")].find(b=>b.textContent==="Eliminar"));
        setTimeout(()=>{ console.log("Delete sent to journal:", deleted&&deleted.tbl==="journal"); console.log("JOURNAL SMOKE OK"); },30);
      },30);
    },30);
  },30);
}catch(e){console.log("ERR",e.message,e.stack);}},120);
