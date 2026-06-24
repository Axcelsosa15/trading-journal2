const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
const SEED=[{id:"s1",date:"2026-06-10",time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5410,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"n",pnl:50,account_id:null,tags:[],mae:"",mfe:"",screenshot_path:"u1/shot.png"}];
let uploadCalls=[],signedCalls=[];
const storage={from:(bucket)=>({
  upload:async(path,file,opts)=>{uploadCalls.push({bucket,path});return {data:{path},error:null};},
  createSignedUrl:async(path,exp)=>{signedCalls.push(path);return {data:{signedUrl:"https://signed.example/"+encodeURIComponent(path)},error:null};},
})};
function makeFrom(tbl){let op="select",payload=null,single=false;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>{single=true;return b;};b.maybeSingle=()=>{single=true;return b;};
 b.insert=(r)=>{op="insert";payload=r;return b;};b.update=(r)=>{op="update";payload=r;return b;};b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data;
   if(op==="insert"||op==="update"){const withId=Object.assign({id:"new1"},payload);data=single?withId:[withId];}
   else{data=tbl==="trades"?SEED.slice():(tbl==="user_settings"?null:[]);if(single&&Array.isArray(data))data=data[0]||null;}
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom,storage})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  // --- display path: open detail of seeded trade with a screenshot
  click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  const row=[...d.querySelectorAll("main button")].find(b=>b.style.display==="grid"&&/MES/.test(b.textContent));
  click(row);
  setTimeout(()=>{try{
    const img=d.querySelector(".dc-drawer img");
    console.log("Detail shows screenshot <img>:", !!img);
    console.log("Signed URL requested for stored path:", signedCalls.indexOf("u1/shot.png")>=0);
    console.log("Image src is the signed URL:", !!img && /^https:\/\/signed\.example\//.test(img.src||""));
    // --- upload path: add a trade with an attached image
    click([...d.querySelectorAll("button")].find(b=>/Nueva operaci/.test(b.textContent)));
    const nums=[...d.querySelectorAll("#modal-root input[type=number]")].filter(i=>i.getAttribute("placeholder")==="0.00");
    nums[0].value="5400";nums[0].dispatchEvent(new window.Event("input",{bubbles:true}));
    nums[1].value="5420";nums[1].dispatchEvent(new window.Event("input",{bubbles:true}));
    const fileInput=d.querySelector("#modal-root input[type=file]");
    const file=new window.File([Buffer.from([1,2,3])],"chart.png",{type:"image/png"});
    Object.defineProperty(fileInput,"files",{value:[file],configurable:true});
    fileInput.dispatchEvent(new window.Event("change",{bubbles:true}));
    setTimeout(()=>{try{
      const save=[...d.querySelectorAll("#modal-root button")].find(b=>/Guardar operaci/.test(b.textContent));
      click(save);
      setTimeout(()=>{try{
        console.log("Upload called once:", uploadCalls.length===1);
        console.log("Upload uses private bucket:", uploadCalls[0]&&uploadCalls[0].bucket==="trade-screenshots");
        console.log("Object stored under user's uid folder:", !!uploadCalls[0]&&/^u1\//.test(uploadCalls[0].path));
        console.log("Modal closed after save:", d.getElementById("modal-root").children.length===0);
        const rows=[...d.querySelectorAll("main button")].filter(b=>b.style.display==="grid");
        console.log("New trade added (2 rows):", rows.length===2);
        console.log("SCREENSHOTS SMOKE OK");
      }catch(e){console.log("ERR3",e.message,e.stack);}},140);
    }catch(e){console.log("ERR2b",e.message,e.stack);}},80);
  }catch(e){console.log("ERR2",e.message,e.stack);}},120);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
