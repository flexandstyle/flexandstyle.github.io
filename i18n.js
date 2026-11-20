(function(){
"use strict";
// static host: stub dead backend endpoints (analytics beacon, presence,
// emergency notice, form posts) so they don't hit the network or log 404/405
(function(){
  var DEAD=/\/(__vp\/api\/|api\/admin\/|v1\/public\/(presence|leads|job-applications|touchpoints|tenants\/by-slug\/[^/?#]+\/touchpoints))/;
  var _f=window.fetch;
  if(_f)window.fetch=function(u){var s=typeof u==='string'?u:(u&&u.url)||'';if(DEAD.test(s))return Promise.resolve(new Response('[]',{status:200,headers:{'Content-Type':'application/json'}}));return _f.apply(this,arguments)};
  var _b=navigator.sendBeacon;
  if(_b)navigator.sendBeacon=function(u){if(DEAD.test(typeof u==='string'?u:''))return true;return _b.apply(this,arguments)};
  var _o=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){if(DEAD.test(typeof u==='string'?u:'')){m='GET';u='/api-stub.json'}return _o.call(this,m,u)};
})();
var D=window.I18N||{m:{},p:[]};
var IDX={en:0,sl:1,sr:2};
var LANGS=['ru','en','sl','sr'];
var cur='ru';
var busy=false;
var obs=null;

// capture original RU head values as early as possible (defer runs before hydration)
function captureBase(){
  try{
    if(document.__ruT===undefined){
      var seal=document.querySelector('meta[name="ru-t"]');
      var t=seal?seal.getAttribute('content'):document.title;
      if(t)document.__ruT=t;
    }
    var metas=document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]');
    for(var i=0;i<metas.length;i++){var mt=metas[i],v=mt.getAttribute('content');if(v&&mt.__ru===undefined)mt.__ru=v;}
  }catch(e){}
}
captureBase();

var norm=function(s){return s.replace(/\s+/g,' ').trim();};

// lookup: returns [en,sl,sr] or null. Patterns produce a string directly.
function lookupText(raw,depth){
  depth=depth||0;
  var key=norm(raw);
  if(!key)return null;
  if(key.indexOf('{')>=0||key.indexOf('}')>=0)return null; // never touch templates React fills
  var hit=D.m[key];
  if(hit)return {arr:hit};
  for(var i=0;i<D.p.length;i++){
    var p=D.p[i];
    var re=p._re||(p._re=new RegExp(p.re));
    var m=key.match(re);
    if(m){
      var out=p.t.map(function(tpl,li){
        var s=tpl;
        for(var j=0;j<p.keys.length;j++){
          var sub=lookupText(m[j+1],depth+1);
          var val=sub?sub.arr[li]:m[j+1];
          s=s.replace('{'+p.keys[j]+'}',function(){return val;});
        }
        return s;
      });
      return {arr:out};
    }
  }
  if(depth<3&&D.g)for(var gi=0;gi<D.g.length;gi++){
    var g=D.g[gi];
    var gre=g._re||(g._re=new RegExp(g.re));
    var gm=key.match(gre);
    if(!gm)continue;
    if(g.suf){
      var h=lookupText(gm[1],depth+1);
      if(h)return {arr:h.arr.map(function(s,j){return s+g.suf[j];})};
      continue;
    }
    if(g.tpl){
      return {arr:g.tpl.map(function(t,j){
        var s=t;
        for(var k=1;k<gm.length;k++){
          var sub2=lookupText(gm[k],depth+1);
          var v=sub2?sub2.arr[j]:gm[k];
          s=s.split('{'+k+'}').join(v);
        }
        return s;
      })};
    }
    if(g.q){
      var pre=gm[1],qq=gm[2],post=gm[3];
      var hp=pre&&lookupText(pre,depth+1);
      var hq=qq&&lookupText(qq,depth+1);
      var hs=post&&lookupText(post,depth+1);
      return {arr:[0,1,2].map(function(j){
        return (hp?hp.arr[j]:pre)+'«'+(hq?hq.arr[j]:qq)+'»'+(hs?hs.arr[j]:post);
      })};
    }
  }
  return null;
}

function trArr(arr){return arr[IDX[cur]];}

function xlateNode(n){
  if(cur==='ru')return;
  if(n.__ru===undefined)n.__ru=n.nodeValue;
  var hit=lookupText(n.__ru!==undefined?n.__ru:n.nodeValue);
  if(hit){
    var pre=n.nodeValue.match(/^\s*/)[0], post=n.nodeValue.match(/\s*$/)[0];
    n.nodeValue=pre+trArr(hit.arr)+post;
  }
}

function restoreNode(n){
  if(n.__ru!==undefined){n.nodeValue=n.__ru;}
}

var SKIP={SCRIPT:1,STYLE:1,NOSCRIPT:1,TEXTAREA:1,TITLE:1};

function walk(root,fn){
  var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{
    acceptNode:function(n){
      if(!n.nodeValue||!n.nodeValue.trim())return NodeFilter.FILTER_REJECT;
      var p=n.parentNode;
      if(p&&SKIP[p.nodeName])return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  var list=[],n;
  while(n=w.nextNode())list.push(n);
  for(var i=0;i<list.length;i++)fn(list[i]);
}

var ATTRS=['alt','title','aria-label','placeholder'];

function walkEls(root,fn){
  var els;
  if(root.nodeType===1){
    els=[root];
    var q=root.querySelectorAll('*');
    for(var i=0;i<q.length;i++)els.push(q[i]);
  }else{
    els=root.querySelectorAll?[].slice.call(root.querySelectorAll('*')):[];
  }
  for(var j=0;j<els.length;j++)fn(els[j]);
}

function xlateEl(el){
  if(cur==='ru')return;
  if(el.tagName==='TITLE')return;
  // attrs
  for(var a=0;a<ATTRS.length;a++){
    var name=ATTRS[a];
    var v=el.getAttribute&&el.getAttribute(name);
    if(v&&v.trim()){
      if(el.__ruA===undefined)el.__ruA={};
      if(el.__ruA[name]===undefined)el.__ruA[name]=v;
      var hit=lookupText(el.__ruA[name]);
      if(hit)el.setAttribute(name,trArr(hit.arr));
    }
  }
  // innerHTML strings that contain markup (e.g. <b>...</b>) — only for pure
  // formatting content; rewriting innerHTML of interactive/React containers
  // orphans their tracked nodes and crashes React's reconciler
  if(el.childElementCount>0&&el.childElementCount<12&&/<[bi]\s*>/i.test(el.innerHTML)
    &&!el.querySelector('a,button,input,select,textarea,[role],[onclick],[contenteditable]')){
    var h=el.__ruH!==undefined?el.__ruH:el.innerHTML;
    var key=norm(h);
    if(key&&key.length<4000){
      var hit2=lookupText(h);
      if(hit2){
        if(el.__ruH===undefined)el.__ruH=el.innerHTML;
        el.innerHTML=trArr(hit2.arr);
        el.__ruHX=1;
      }
    }
  }
}

function restoreEl(el){
  if(el.tagName==='TITLE')return;
  if(el.__ruA){
    for(var k in el.__ruA)el.setAttribute(k,el.__ruA[k]);
  }
  if(el.__ruHX&&el.__ruH!==undefined){el.innerHTML=el.__ruH;el.__ruHX=0;}
}

function applyHead(){
  captureBase();
  if(document.title||document.__ruT){
    var curT=document.title;
    if(cur==='ru'){if(document.__ruT&&document.title!==document.__ruT)document.title=document.__ruT;document.__lastW=document.title;}
    else{
      var nt=document.__ruT;
      var hit=lookupText(document.__ruT);
      if(hit)nt=trArr(hit.arr);
      else{
        // title may combine parts; translate segment before dash
        var m=document.__ruT.match(/^(.*?)\s*[—–-]\s*(.*)$/);
        if(m){var h1=lookupText(m[1]);nt=(h1?trArr(h1.arr):m[1])+' — '+m[2];}
      }
      // React may emit a literal {title}/{name} template — rebuild from visible H1
      if(/\{\w+\}/.test(nt)){
        var h=document.querySelector('h1');
        var suf=(document.__ruT.match(/(\s*[—–-]\s*[^—–-]*)$/)||['',''])[1];
        if(h&&h.textContent.trim())nt=h.textContent.trim()+suf;
      }
      if(document.title!==nt)document.title=nt;
      document.__lastW=document.title;
    }
  }
  var metas=document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]');
  for(var i=0;i<metas.length;i++){
    var mt=metas[i];
    if(mt.__ru===undefined){var cv=mt.getAttribute('content');if(cv&&/[а-яА-ЯёЁ]/.test(cv))mt.__ru=cv;else continue;}
    var nv=mt.__ru;
    if(cur!=='ru'){var h=lookupText(mt.__ru);if(h)nv=trArr(h.arr);}
    if(mt.getAttribute('content')!==nv)mt.setAttribute('content',nv);
  }
  document.documentElement.lang=cur==='ru'?'ru':cur;
}
var headObs=null;
function startHeadObs(){
  if(headObs||cur==='ru')return;
  headObs=new MutationObserver(function(){
    if(busy)return;
    busy=true;headObs.disconnect();
    try{applyHead();}finally{busy=false;headObs.observe(document.head,{childList:true,subtree:true,characterData:true});}
  });
  headObs.observe(document.head,{childList:true,subtree:true,characterData:true});
}

function applyAll(){
  if(busy)return;busy=true;
  window.__i18nCur=SHORT[cur];
  window.__i18nCode=cur;
  if(obs)obs.disconnect();
  try{
    if(cur==='ru'){
      walk(document.body,restoreNode);
      walkEls(document.body,restoreEl);
    }else{
      walk(document.body,xlateNode);
      walkEls(document.body,xlateEl);
    }
    applyHead();
  }finally{
    busy=false;
    startObs();
    startHeadObs();
    // second sweep on next frame: catches nodes React rendered while busy
    setTimeout(function(){
      if(cur==='ru')return;
      busy=true;if(obs)obs.disconnect();
      try{walk(document.body,xlateNode);walkEls(document.body,xlateEl);applyHead();}
      finally{busy=false;if(obs)obs.observe(document.body,{childList:true,subtree:true,characterData:true});}
    },80);
  }
}

function startObs(){
  if(obs)return;
  obs=new MutationObserver(function(muts){
    if(busy)return;
    var roots=[];
    for(var i=0;i<muts.length;i++){
      var mu=muts[i];
      for(var j=0;j<mu.addedNodes.length;j++){
        var nd=mu.addedNodes[j];
        if(nd.nodeType===1||nd.nodeType===3)roots.push(nd);
      }
      if(mu.type==='characterData')roots.push(mu.target);
    }
    if(!roots.length)return;
    busy=true;obs.disconnect();
    try{
      var titleHit=false;
      for(var k=0;k<roots.length;k++){
        var r=roots[k];
        if(r.nodeType===3){
          if(r.parentNode&&r.parentNode.nodeName==='TITLE')titleHit=true;
          else xlateNode(r);
        }
        else if(r.nodeType===1){
          if(r.tagName==='TITLE'){titleHit=true;continue;}
          walk(r,xlateNode);walkEls(r,xlateEl);
          if(r.querySelector&&r.querySelector('title'))titleHit=true;
        }
      }
      if(titleHit)applyHead();
      patchHeroLogo();
      patchChrome();
    }finally{busy=false;obs.observe(document.body,{childList:true,subtree:true,characterData:true});}
  });
  obs.observe(document.body,{childList:true,subtree:true,characterData:true});
}

var SHORT={en:'EN',sl:'SL',sr:'SR',ru:'RU'};
function patchHeroLogo(){} // hero logo removed per design
// strip disabled outcall links (vyezd) wherever they render
var VYEZD_SEL='a[href^="/vyezd"],a[href*="podarok-na-vyezd"],a[href*="vyiezdom-na-dom"],a[href*="na-domu"]';
function cleanVyezd(root){
  try{
    var els=(root||document).querySelectorAll?[].slice.call((root||document).querySelectorAll(VYEZD_SEL)):[];
    for(var i=0;i<els.length;i++){
      var li=els[i].closest('li');
      if(li)li.remove();else els[i].remove();
    }
  }catch(e){}
}
cleanVyezd(document);

// ===== drawer extras: language switch + 24/7 + phone =====
var MENU_LANG_ORDER=['ru','sl','en','sr'];
function patchMenu(){
  try{
    var dr=document.querySelector('.drawer');
    if(!dr||dr.querySelector('.bs-menu-meta'))return;
    var meta=document.createElement('div');
    meta.className='bs-menu-meta';
    var langBtns='';
    for(var i=0;i<MENU_LANG_ORDER.length;i++){
      var c=MENU_LANG_ORDER[i];
      langBtns+='<button type="button" data-l="'+c+'"'+(cur===c?' class="on"':'')+'>'+SHORT[c]+'</button>';
    }
    meta.innerHTML='<div class="bs-mm-line"><span class="bs-mm-247">24/7</span><span class="bs-mm-phone">+386 40 210 380</span></div><div class="bs-menu-lang">'+langBtns+'</div>';
    var mc=dr.querySelector('.bs-menu-contacts');
    dr.insertBefore(meta,mc||dr.querySelector('.bs-menu-addr')||null);
    meta.addEventListener('click',function(e){
      var b=e.target&&e.target.closest('button[data-l]');
      if(!b)return;
      window.__setLang(b.getAttribute('data-l'));
      var all=meta.querySelectorAll('button');
      for(var k=0;k<all.length;k++)all[k].classList.toggle('on',all[k]===b);
    });
  }catch(e){}
}

// ===== scroll lock while menu open =====
var lockY=0;
function syncLock(){
  try{
    var open=document.querySelector('.drawer.open');
    if(open&&!document.body.classList.contains('bs-lock')){
      lockY=window.scrollY||document.documentElement.scrollTop||0;
      document.body.classList.add('bs-lock');
      document.body.style.top=(-lockY)+'px';
    }else if(!open&&document.body.classList.contains('bs-lock')){
      document.body.classList.remove('bs-lock');
      document.body.style.top='';
      window.scrollTo(0,lockY);
    }
  }catch(e){}
}
function watchDrawer(){
  try{
    var d=document.querySelector('.drawer');
    if(!d||d.__lockWatched)return;
    d.__lockWatched=1;
    new MutationObserver(syncLock).observe(d,{attributes:true,attributeFilter:['class']});
    syncLock();
  }catch(e){}
}

// ===== custom map pin =====
function patchMapPin(){
  try{
    var ifr=document.querySelector('iframe[title="map"]');
    if(!ifr||!ifr.parentElement)return;
    var p=ifr.parentElement;
    if(p.querySelector('.bs-map-pin'))return;
    if(getComputedStyle(p).position==='static')p.style.position='relative';
    var pin=document.createElement('div');
    pin.className='bs-map-pin';
    pin.innerHTML='<i></i><img src="/brand/logo-head.png" alt=""/>';
    p.appendChild(pin);
  }catch(e){}
}

// first catalog rows load eagerly; deep list stays lazy
var eagerDone=false;
function patchLazy(){
  if(eagerDone)return;
  var imgs=document.querySelectorAll('main img[loading="lazy"]');
  if(imgs.length<4)return;
  eagerDone=true;
  for(var i=0;i<imgs.length&&i<10;i++){
    imgs[i].loading='eager';
    try{imgs[i].fetchPriority='high';}catch(e){}
  }
}

// security: external links open safely
function patchBlank(){
  var ls=document.querySelectorAll('a[target="_blank"]:not([rel*="noopener"])');
  for(var i=0;i<ls.length;i++)ls[i].rel='noopener noreferrer';
}

function patchChrome(){
  cleanVyezd(document);
  patchMenu();
  watchDrawer();
  patchMapPin();
  patchSupport();
  patchLazy();
  patchBlank();
}

// land on top after navigation unless a hash anchor is present
if('scrollRestoration' in history)history.scrollRestoration='auto';
if(!location.hash)window.scrollTo(0,0);
if(document.readyState==='complete')setTimeout(patchChrome,400);
else window.addEventListener('load',function(){setTimeout(patchChrome,400);});
document.addEventListener('DOMContentLoaded',function(){setTimeout(patchChrome,300);});

// support widget: peach circle -> oval with WhatsApp + Telegram
function patchSupport(){
  try{
    if(document.querySelector('.bs-sup'))return;
    var fan=document.querySelector('.site-touchpoints-fan');
    var wa=null,tg=null;
    if(fan){
      wa=fan.querySelector('a[href*="wa.me"]');
      tg=fan.querySelector('a[href*="t.me"]');
    }
    var w=document.createElement('div');
    w.className='bs-sup';
    var oval='<div class="bs-sup-oval"></div>';
    w.innerHTML=oval+'<button type="button" class="bs-sup-btn" aria-label="Support"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></button>';
    var ov=w.querySelector('.bs-sup-oval');
    if(wa){var a=wa.cloneNode(true);a.removeAttribute('style');a.removeAttribute('aria-hidden');a.className='bs-sup-i';ov.appendChild(a);}
    if(tg){var b=tg.cloneNode(true);b.removeAttribute('style');b.removeAttribute('aria-hidden');b.className='bs-sup-i';ov.appendChild(b);}
    var xs=document.createElement('span');xs.className='bs-sup-x';xs.innerHTML='&times;';ov.appendChild(xs);
    document.body.appendChild(w);
    w.querySelector('.bs-sup-btn').addEventListener('click',function(){w.classList.toggle('open');});
    w.querySelector('.bs-sup-x').addEventListener('click',function(){w.classList.remove('open');});
  }catch(e){}
}

// lightweight lightbox for photo galleries
document.addEventListener('click',function(e){
  var lb=document.querySelector('.bs-lb');
  if(lb){lb.remove();document.body.style.overflow='';return;}
  var t=e.target;
  if(!t||t.tagName!=='IMG')return;
  if(t.closest('a,button,.bs-header,.f-logo,nav'))return;
  if(!t.closest('.int-thumbs,.bs-art-gallery,.pick .strip,.models-list,.m-grid,.profile-photos,.a-gallery'))return;
  var o=document.createElement('div');
  o.className='bs-lb';
  o.setAttribute('role','dialog');
  o.setAttribute('aria-label','Photo preview');
  o.innerHTML='<img src="'+t.src+'" alt="'+(t.alt||'')+'"/><span class="bs-lb-x" role="button" aria-label="Close">&#215;</span>';
  document.body.appendChild(o);
  document.body.style.overflow='hidden';
  e.preventDefault();
});
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape')return;
  var lb=document.querySelector('.bs-lb');
  if(lb){lb.remove();document.body.style.overflow='';}
});

window.__setLang=function(code){
  if(LANGS.indexOf(code)<0)return;
  try{localStorage.setItem('bs-lang',code);}catch(e){}
  cur=code;
  applyAll();
};

window.__getLang=function(){return cur;};

function init(){
  var saved='ru';
  try{saved=localStorage.getItem('bs-lang')||'ru';}catch(e){}
  if(LANGS.indexOf(saved)<0)saved='ru';
  cur=saved;
  if(cur!=='ru'){
    var go=function(){setTimeout(applyAll,700);};
    if(document.readyState==='complete')go();
    else window.addEventListener('load',go);
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();
