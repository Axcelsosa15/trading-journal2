(function () {
  "use strict";
  var KEY = "bitacora_strategy_lab_v1";
  var STYLE = "sl-panel{display:block}";
  var css = `
    .sl-panel{margin:16px 0;padding:18px;border:1px solid var(--rp-line,#2d3540);border-radius:14px;background:linear-gradient(180deg,var(--rp-panel-1,#20242b),var(--rp-panel-2,#171a20));color:var(--rp-ink,#eef0f3)}
    .sl-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
    .sl-title{font-size:15px;font-weight:900}.sl-copy{font-size:12px;color:var(--rp-muted,#9ca5b2);margin-top:4px;max-width:760px}
    .sl-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:14px 0}
    .sl-kpi{padding:12px;border:1px solid var(--rp-line,#2d3540);border-radius:10px;background:var(--rp-card,#1b1f25);min-width:0}
    .sl-label{font-size:10px;font-weight:800;color:var(--rp-muted,#9ca5b2);text-transform:uppercase;letter-spacing:.06em}
    .sl-value{font-size:20px;font-weight:900;margin-top:5px;overflow-wrap:anywhere}.sl-note{font-size:10px;color:var(--rp-muted,#9ca5b2);margin-top:3px}
    .sl-form{display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr auto;gap:8px;margin:12px 0}
    .sl-form input,.sl-form select{min-width:0;width:100%;box-sizing:border-box;border:1px solid var(--rp-line,#2d3540);border-radius:9px;padding:9px;background:var(--rp-card,#1b1f25);color:var(--rp-ink,#eef0f3);font:inherit;font-size:12px}
    .sl-btn{border:1px solid var(--rp-line,#2d3540);border-radius:9px;padding:9px 12px;background:var(--rp-card,#1b1f25);color:var(--rp-ink,#eef0f3);font-weight:800;cursor:pointer}
    .sl-status{font-size:11px;color:var(--rp-muted,#9ca5b2);margin:8px 0}.sl-list{display:grid;gap:7px}
    .sl-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:10px;border:1px solid var(--rp-line,#2d3540);border-radius:9px}
    .sl-name{font-size:12px;font-weight:800}.sl-meta{font-size:10px;color:var(--rp-muted,#9ca5b2);margin-top:3px}
    .sl-chip{font-size:10px;font-weight:800;border:1px solid var(--rp-line,#2d3540);padding:4px 7px;border-radius:999px;color:var(--rp-muted,#9ca5b2)}
    .sl-positive{color:var(--rp-green,#15905b)}.sl-negative{color:var(--rp-red,#d6483b)}
    @media(max-width:820px){.sl-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.sl-form{grid-template-columns:1fr 1fr}.sl-form button{grid-column:1/-1}.sl-row{grid-template-columns:1fr auto}.sl-row .sl-chip{grid-column:1/-1;justify-self:start}}
  `;
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function readCache(){
    var best=null;
    try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(!/^bitacora_cache_/.test(k||""))continue;var x=JSON.parse(localStorage.getItem(k));if(x&&Array.isArray(x.trades)&&(!best||(x.ts||0)>(best.ts||0)))best=x;}}catch(e){}
    return best||{trades:[],accounts:[]};
  }
  function readLab(){try{var x=JSON.parse(localStorage.getItem(KEY)||"{}");return x&&Array.isArray(x.strategies)?x:{strategies:[]};}catch(e){return {strategies:[]};}}
  function saveLab(x){try{localStorage.setItem(KEY,JSON.stringify(x));}catch(e){}}
  function tagsOf(t){var a=t.tags;if(Array.isArray(a))return a.map(String);if(typeof a==="string"){try{var p=JSON.parse(a);if(Array.isArray(p))return p.map(String);}catch(e){}return a.split(",").map(function(v){return v.trim();}).filter(Boolean);}return [];}
  function n(v){var x=Number(v);return v!==""&&v!=null&&isFinite(x)?x:null;}
  function money(v){return v==null||!isFinite(v)?"—":(v<0?"−":"+")+"$"+Math.abs(v).toLocaleString("en-US",{maximumFractionDigits:2});}
  function metric(trades){
    var rows=trades.filter(function(t){return n(t.pnl)!=null;});
    var wins=rows.filter(function(t){return n(t.pnl)>0;}),loss=rows.filter(function(t){return n(t.pnl)<0;});
    var sum=function(xs){return xs.reduce(function(a,t){return a+n(t.pnl);},0);};
    var gp=sum(wins),gl=Math.abs(sum(loss)),net=gp-gl;
    var run=0,peak=0,dd=0,streak=0,maxStreak=0;
    rows.forEach(function(t){run+=n(t.pnl);peak=Math.max(peak,run);dd=Math.max(dd,peak-run);if(n(t.pnl)<0){streak++;maxStreak=Math.max(maxStreak,streak);}else if(n(t.pnl)>0)streak=0;});
    var rs=rows.map(function(t){var risk=n(t.risk)||n(t.initial_risk)||n(t.risk_amount);if(risk==null){var rt=tagsOf(t).filter(function(x){return /^risk:/i.test(x);})[0];if(rt)risk=n(rt.split(":")[1]);}return risk&&risk>0?n(t.pnl)/risk:null;}).filter(function(v){return v!=null;});
    return {count:rows.length,net:net,pf:gl?gp/gl:(gp>0?Infinity:null),expectancy:rows.length?net/rows.length:null,dd:dd,lossStreak:maxStreak,avgR:rs.length?rs.reduce(function(a,b){return a+b;},0)/rs.length:null,rCount:rs.length};
  }
  function strategiesFromTrades(trades){
    var out={};
    trades.forEach(function(t){tagsOf(t).forEach(function(tag){var m=tag.match(/^strategy:([^|]+?)(?:\|version:([^|]+))?$/i);if(!m)return;var name=m[1].trim(),version=(m[2]||"Unversioned").trim(),key=name+"::"+version;if(!out[key])out[key]={name:name,version:version,trades:[]};out[key].trades.push(t);});});
    return Object.keys(out).map(function(k){var x=out[k];x.stats=metric(x.trades);return x;});
  }
  function mount(){
    var main=document.querySelector("main"),wrap=main&&main.querySelector("header > div"),title=wrap&&wrap.firstElementChild;
    if(!main||!title||String(title.textContent||"").trim()!=="Research quality")return;
    var container=main.querySelector(".dc-scroll");if(!container)return;
    var panel=container.querySelector("[data-sl-panel]");if(!panel){panel=document.createElement("section");panel.className="sl-panel";panel.setAttribute("data-sl-panel","1");container.insertAdjacentElement("afterbegin",panel);}
    var cache=readCache(),lab=readLab(),groups=strategiesFromTrades(cache.trades||[]);
    var all=metric(cache.trades||[]),rows=lab.strategies.map(function(s){return {name:s.name,version:s.version,status:s.status||"En desarrollo",created:s.created||"",rules:s.rules||""};});
    var list=rows.map(function(s){var g=groups.filter(function(x){return x.name===s.name&&x.version===s.version;})[0],st=g?g.stats:metric([]);return '<div class="sl-row"><div><div class="sl-name">'+esc(s.name)+' <span class="sl-meta">· '+esc(s.version)+'</span></div><div class="sl-meta">'+esc(s.status)+(s.rules?" · "+esc(s.rules):"")+'</div></div><strong class="'+(st.net<0?"sl-negative":"sl-positive")+'">'+money(st.net)+'</strong><span class="sl-chip">'+st.count+' trades</span></div>';}).join("");
    panel.innerHTML='<div class="sl-head"><div><div class="sl-title">Strategy Stability Lab</div><div class="sl-copy">Evalúa la estrategia por versión, no solo por cuenta. Los resultados se calculan con trades cerrados disponibles en el journal. R requiere riesgo inicial registrado por trade. Una muestra pequeña no demuestra estabilidad.</div></div><span class="sl-chip">'+all.count+' trades cerrados · '+rows.length+' versiones registradas</span></div>'+
      '<div class="sl-kpis"><div class="sl-kpi"><div class="sl-label">Expectancy / trade</div><div class="sl-value">'+money(all.expectancy)+'</div><div class="sl-note">PnL neto promedio</div></div><div class="sl-kpi"><div class="sl-label">Profit factor</div><div class="sl-value">'+(all.pf===Infinity?"∞":all.pf==null?"—":all.pf.toFixed(2))+'</div><div class="sl-note">Ganancia bruta / pérdida bruta</div></div><div class="sl-kpi"><div class="sl-label">Max drawdown</div><div class="sl-value sl-negative">'+money(-all.dd)+'</div><div class="sl-note">Drawdown por secuencia de trades</div></div><div class="sl-kpi"><div class="sl-label">R promedio</div><div class="sl-value">'+(all.avgR==null?"—":all.avgR.toFixed(2)+"R")+'</div><div class="sl-note">'+all.rCount+' trades con riesgo identificado</div></div></div>'+
      '<div class="sl-status">Para etiquetar trades de una estrategia usa tags: <b>strategy:Nombre|version:1.0</b>. Las etiquetas permiten separar resultados sin mezclar versiones.</div>'+
      '<form class="sl-form" data-sl-form><input name="name" required maxlength="80" placeholder="Nombre de estrategia"><input name="version" required maxlength="30" placeholder="Versión (ej. 1.0)"><select name="status"><option>En desarrollo</option><option>Recopilando datos</option><option>En validación</option><option>En observación</option><option>Estable según criterios</option><option>En deterioro</option></select><input name="rules" maxlength="160" placeholder="Reglas / cambio de versión"><button class="sl-btn" type="submit">Guardar versión</button></form>'+
      '<div class="sl-list">'+(list||'<div class="sl-status">Todavía no hay versiones registradas. Crea una versión arriba y etiqueta las operaciones correspondientes.</div>')+'</div>';
    var form=panel.querySelector("[data-sl-form]");if(form&&!form.__slBound){form.__slBound=true;form.addEventListener("submit",function(e){e.preventDefault();var fd=new FormData(form),name=String(fd.get("name")||"").trim(),version=String(fd.get("version")||"").trim();if(!name||!version)return;var x=readLab(),i=x.strategies.findIndex(function(s){return s.name===name&&s.version===version;});var item={name:name,version:version,status:String(fd.get("status")||"En desarrollo"),rules:String(fd.get("rules")||"").trim(),created:new Date().toISOString()};if(i>=0)x.strategies[i]=item;else x.strategies.push(item);saveLab(x);mount();});}
  }
  var observer=new MutationObserver(function(){if(!window.__slQueued){window.__slQueued=true;requestAnimationFrame(function(){window.__slQueued=false;mount();});}});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener("focus",mount);window.addEventListener("storage",mount);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount);else mount();
})();