const fs=require("fs");const {JSDOM}=require("jsdom");const vm=require("vm");
const dom=new JSDOM(fs.readFileSync("index.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://example.com/"});
const {window}=dom; const d=window.document;
function makeFrom(){const b={};b.select=()=>b;b.order=()=>b;b.eq=()=>b;b.single=()=>b;b.maybeSingle=()=>b;b.insert=()=>b;b.update=()=>b;b.upsert=()=>b;b.delete=()=>b;b.then=(res)=>Promise.resolve({data:[],error:null}).then(res);return b;}
let session=null; // logged out -> auth screen
window.supabase={createClient:()=>({auth:{onAuthStateChange:cb=>({data:{subscription:{unsubscribe(){}}}}),getSession:()=>Promise.resolve({data:{session}}),signOut:async()=>({error:null})},from:makeFrom})};
vm.runInContext(fs.readFileSync("app.js","utf8"),dom.getInternalVMContext(),{filename:"app.js"});
setTimeout(()=>{try{
  const hrefs=[...d.querySelectorAll("a")].map(a=>a.getAttribute("href"));
  console.log("Login screen links Privacidad:", hrefs.indexOf("privacy.html")>=0);
  console.log("Login screen links Términos:", hrefs.indexOf("terms.html")>=0);
  console.log("Login screen links Cookies:", hrefs.indexOf("cookies.html")>=0);
  console.log("Login screen links Seguridad:", hrefs.indexOf("security.html")>=0);
  const legal=[...d.querySelectorAll("a")].filter(a=>/^(privacy|terms|cookies|security)\.html$/.test(a.getAttribute("href")||""));
  console.log("Legal links open in new tab safely:", legal.length===4 && legal.every(a=>a.getAttribute("target")==="_blank"&&/noopener/.test(a.getAttribute("rel")||"")));
  console.log("AUTH LEGAL SMOKE OK");
}catch(e){console.log("ERR",e.message,e.stack);}},120);
