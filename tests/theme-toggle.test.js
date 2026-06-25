// Dark mode: a sidebar toggle flips <html data-theme>, persists the choice to
// localStorage, and the dark stylesheet is wired in. Light is the default.
const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
function makeFrom(tbl){const b={};b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;
  b.single=()=>Promise.resolve({data:null,error:null});b.maybeSingle=()=>Promise.resolve({data:null,error:null});
  b.then=(res,rej)=>Promise.resolve({data:[],error:null}).then(res,rej);return b;}
let session={user:{email:"t@t.com",id:"u1"}};
const storage={from:()=>({list:async()=>({data:[]}),remove:async()=>({}),createSignedUrl:async()=>({data:{signedUrl:"x"}})})};
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom,storage})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
const themeBtn=()=>[...d.querySelectorAll("aside button, .side button")].find(b=>/Modo (oscuro|claro)/.test(b.getAttribute("title")||""));
setTimeout(()=>{try{
  console.log("Default theme is light:", d.documentElement.getAttribute("data-theme")==="light");
  const b1=themeBtn();
  console.log("Theme toggle present in sidebar:", !!b1 && b1.getAttribute("title")==="Modo oscuro");
  if(b1)click(b1);
  setTimeout(()=>{try{
    console.log("Toggles to dark:", d.documentElement.getAttribute("data-theme")==="dark");
    console.log("Choice persisted to localStorage:", window.localStorage.getItem("bitacora_theme")==="dark");
    const b2=themeBtn();
    console.log("Toggle now offers light mode:", !!b2 && b2.getAttribute("title")==="Modo claro");
    if(b2)click(b2);
    setTimeout(()=>{try{
      console.log("Toggles back to light:", d.documentElement.getAttribute("data-theme")==="light" && window.localStorage.getItem("bitacora_theme")==="light");
      const idx=fs.readFileSync("index.html","utf8"), darkcss=fs.readFileSync("theme-dark.css","utf8");
      console.log("Dark stylesheet linked + uses inversion:", /href="theme-dark\.css"/.test(idx) && /data-theme="dark"/.test(darkcss) && /invert\(1\)/.test(darkcss));
      console.log("THEME TOGGLE SMOKE OK");
    }catch(e){console.log("ERR3",e.message,e.stack);}},60);
  }catch(e){console.log("ERR2",e.message,e.stack);}},60);
}catch(e){console.log("ERR",e.message,e.stack);}},160);
