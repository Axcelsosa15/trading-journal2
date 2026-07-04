const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
const SEED=[{id:"s1",date:"2026-06-10",time:"10:00",symbol:"MES",type:"future",side:"long",contracts:1,entry:5400,exit:5410,setup:"Ruptura",emotion:"Tranquilo",rating:4,note:"n",pnl:50,account_id:null,tags:[],mae:"",mfe:"",screenshot_path:"u1/old-shot.png"}];
let uploadCalls=[],removeCalls=[];
const storage={from:(bucket)=>({
  upload:async(path,file,opts)=>{uploadCalls.push({bucket,path});return {data:{path},error:null};},
  createSignedUrl:async(path,exp)=>({data:{signedUrl:"https://signed.example/"+encodeURIComponent(path)},error:null}),
  remove:async(paths)=>{removeCalls.push(paths);return {data:paths,error:null};},
})};
function makeFrom(tbl){let op="select",payload=null,single=false;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>{single=true;return b;};b.maybeSingle=()=>{single=true;return b;};
 b.insert=(r)=>{op="insert";payload=r;return b;};b.update=(r)=>{op="update";payload=r;return b;};b.upsert=()=>b;b.delete=()=>{op="delete";return b;};
 b.then=(res,rej)=>{let data;
   if(op==="insert"||op==="update"){const withId=Object.assign({id:tbl==="trades"&&op==="update"?"s1":"new1"},payload);data=single?withId:[withId];}
   else if(op==="delete"){data=null;}
   else{data=tbl==="trades"?SEED.slice():(tbl==="user_settings"?null:[]);if(single&&Array.isArray(data))data=data[0]||null;}
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom,storage})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  click([...d.querySelectorAll("aside nav button")].find(b=>/Operaciones/.test(b.textContent)));
  const row=[...d.querySelectorAll("main button")].find(b=>b.style.display==="grid"&&/MES/.test(b.textContent));
  click(row);
  setTimeout(()=>{try{
    // --- replace path: edit the trade and attach a new screenshot
    const editBtn=[...d.querySelectorAll(".dc-drawer button")].find(b=>/Editar/.test(b.textContent));
    click(editBtn);
    setTimeout(()=>{try{
      const fileInput=d.querySelector("#modal-root input[type=file]");
      const file=new window.File([Buffer.from([1,2,3])],"new-chart.png",{type:"image/png"});
      Object.defineProperty(fileInput,"files",{value:[file],configurable:true});
      fileInput.dispatchEvent(new window.Event("change",{bubbles:true}));
      setTimeout(()=>{try{
        const save=[...d.querySelectorAll("#modal-root button")].find(b=>/Guardar cambios/.test(b.textContent));
        click(save);
        setTimeout(()=>{try{
          console.log("Uploaded the new screenshot:", uploadCalls.length===1);
          console.log("Old screenshot removed after replace:", removeCalls.some(p=>p.indexOf("u1/old-shot.png")>=0));
          // --- delete path: remove the trade and confirm its screenshot is cleaned up
          const row2=[...d.querySelectorAll("main button")].find(b=>b.style.display==="grid"&&/MES/.test(b.textContent));
          click(row2);
          setTimeout(()=>{try{
            const delBtn=[...d.querySelectorAll(".dc-drawer button")].find(b=>/Eliminar/.test(b.textContent));
            click(delBtn);
            setTimeout(()=>{try{
              const replacedPath=uploadCalls[0]&&uploadCalls[0].path;
              console.log("Screenshot removed on trade delete:", removeCalls.length===2 && removeCalls[1].indexOf(replacedPath)>=0);
              console.log("SCREENSHOT-CLEANUP SMOKE OK");
            }catch(e){console.log("ERR4",e.message,e.stack);}},80);
          }catch(e){console.log("ERR3",e.message,e.stack);}},100);
        }catch(e){console.log("ERR2",e.message,e.stack);}},140);
      }catch(e){console.log("ERR1b",e.message,e.stack);}},80);
    }catch(e){console.log("ERR1",e.message,e.stack);}},120);
  }catch(e){console.log("ERR0b",e.message,e.stack);}},120);
}catch(e){console.log("ERR0",e.message,e.stack);}},150);
