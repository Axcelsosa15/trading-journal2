// Image compression on upload: with browser image APIs available, a large PNG
// screenshot is downscaled (<=1600px) and re-encoded to a smaller JPEG before
// it ever reaches storage. Stubs createImageBitmap + canvas (jsdom has neither).
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
const ORIGINAL_SIZE=50000; const comp={};
// Stub the browser image pipeline before app.js runs.
window.createImageBitmap=async function(){return {width:3200,height:1800,close(){}};};
const realCreate=d.createElement.bind(d);
d.createElement=function(tag){
  if(String(tag).toLowerCase()==="canvas"){
    const c={width:0,height:0,getContext:()=>({drawImage(){}}),
      toBlob:(cb,type,q)=>{comp.type=type;comp.q=q;comp.w=c.width;comp.h=c.height;cb(new window.Blob([Buffer.alloc(1200)],{type:type}));}};
    return c;
  }
  return realCreate(tag);
};
let uploadCalls=[];
const storage={from:(bucket)=>({
  upload:async(path,file,opts)=>{uploadCalls.push({bucket,path,fileType:file.type,fileSize:file.size,contentType:opts&&opts.contentType});return {data:{path},error:null};},
  createSignedUrl:async(path)=>({data:{signedUrl:"https://s/"+path},error:null}),
})};
function makeFrom(tbl){let op="select",payload=null,single=false;const b={};
 b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>{single=true;return b;};b.maybeSingle=()=>{single=true;return b;};
 b.insert=(r)=>{op="insert";payload=r;return b;};b.update=(r)=>{op="update";payload=r;return b;};b.upsert=()=>b;b.delete=()=>b;
 b.then=(res,rej)=>{let data;
   if(op==="insert"||op==="update"){const withId=Object.assign({id:"new1"},payload);data=single?withId:[withId];}
   else{data=tbl==="trades"?[]:(tbl==="user_settings"?null:[]);if(single&&Array.isArray(data))data=data[0]||null;}
   return Promise.resolve({data,error:null}).then(res,rej);};
 return b;}
let session={user:{email:"t@t.com",id:"u1"}};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom,storage})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
setTimeout(()=>{try{
  click([...d.querySelectorAll("button")].find(b=>/Nueva operaci/.test(b.textContent)));
  const nums=[...d.querySelectorAll("#modal-root input[type=number]")].filter(i=>i.getAttribute("placeholder")==="0.00");
  nums[0].value="5400";nums[0].dispatchEvent(new window.Event("input",{bubbles:true}));
  nums[1].value="5420";nums[1].dispatchEvent(new window.Event("input",{bubbles:true}));
  const fileInput=d.querySelector("#modal-root input[type=file]");
  const file=new window.File([Buffer.alloc(ORIGINAL_SIZE)],"chart.png",{type:"image/png"});
  Object.defineProperty(fileInput,"files",{value:[file],configurable:true});
  fileInput.dispatchEvent(new window.Event("change",{bubbles:true}));
  setTimeout(()=>{try{
    click([...d.querySelectorAll("#modal-root button")].find(b=>/Guardar operaci/.test(b.textContent)));
    setTimeout(()=>{try{
      const u=uploadCalls[0]||{};
      console.log("Upload happened:", uploadCalls.length===1);
      console.log("Canvas downscaled to <=1600px (3200->1600):", comp.w===1600 && comp.h===900);
      console.log("Re-encoded as JPEG at 0.82:", comp.type==="image/jpeg" && comp.q===0.82);
      console.log("Uploaded file is JPEG:", u.fileType==="image/jpeg" && u.contentType==="image/jpeg");
      console.log("Uploaded file is smaller than original:", u.fileSize>0 && u.fileSize<ORIGINAL_SIZE);
      console.log("Stored path uses .jpg extension:", /\.jpg$/.test(u.path||""));
      console.log("IMAGE COMPRESS SMOKE OK");
    }catch(e){console.log("ERR3",e.message,e.stack);}},140);
  }catch(e){console.log("ERR2",e.message,e.stack);}},90);
}catch(e){console.log("ERR",e.message,e.stack);}},150);
