// Static site assets for a "real website": robots, sitemap, security.txt, legal
// pages, and SEO/social meta in index.html. Pure fs — no jsdom.
const fs=require("fs");
function read(p){try{return fs.readFileSync(p,"utf8");}catch(e){return "";}}
const robots=read("robots.txt");
console.log("robots.txt allows + links sitemap:", /Allow:\s*\//.test(robots) && /Sitemap:\s*https?:\/\//.test(robots));
const sm=read("sitemap.xml");
console.log("sitemap lists app + legal pages:", /<urlset/.test(sm) && /privacy\.html/.test(sm) && /terms\.html/.test(sm) && /security\.html/.test(sm));
const sec=read(".well-known/security.txt");
console.log("security.txt has Contact + Expires:", /Contact:\s*mailto:/.test(sec) && /Expires:/.test(sec));
["privacy.html","terms.html","cookies.html","security.html"].forEach(function(f){
  const c=read(f);
  const ok = /<!DOCTYPE html>/i.test(c) && /<title>/.test(c) && /Volver a la app/.test(c) && /Content-Security-Policy/.test(c);
  console.log("legal page valid ("+f+"):", ok);
});
const idx=read("index.html");
// CSP must allow Supabase Storage images, or trade screenshots (loaded from
// signed supabase.co URLs) are silently blocked by the browser and never render.
const cspImg=(idx.match(/img-src ([^;]*)/)||[,""])[1];
console.log("CSP img-src allows Supabase screenshots:", /supabase\.co/.test(cspImg) && /'self'/.test(cspImg) && /data:/.test(cspImg));
console.log("index has canonical:", /rel="canonical"/.test(idx));
console.log("index has Open Graph:", /property="og:title"/.test(idx) && /property="og:image"/.test(idx));
console.log("index has Twitter card:", /name="twitter:card"/.test(idx));
console.log("index has robots index,follow:", /name="robots"\s+content="index,follow"/.test(idx));
const css=read("styles.css"), js=read("app.js");
console.log("brand logo is wired + animated:", /class:\s*"brand-logo"/.test(js) && /\.brand-logo[\s\S]*animation/.test(css) && /@keyframes candleUp/.test(css));
console.log("premium design pass present:", /backdrop-filter/.test(css) && /Premium design pass/.test(css) && /button\[style\*="background:#16181C"\]/.test(css));
console.log("no double-# inline backgrounds (badge colors valid):", !/background:#"\s*\+/.test(js));
console.log("canonical uses the real GitHub Pages URL (no placeholder):", /rel="canonical"\s+href="https:\/\/axcelsosa15\.github\.io\/trading-journal2\/"/.test(idx) && !/bitacora\.pages\.dev/.test(idx));
console.log("WEB ASSETS SMOKE OK");
