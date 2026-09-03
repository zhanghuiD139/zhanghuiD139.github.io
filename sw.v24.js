/* offline shell · v23（v22 基础上只升版本号，强制用户拉到新 index.html）
   本次重点：
   1) tab 「灵感·选题灵感库」→「一学·每日一学」：外网晚 20:00 自动抓 8 大主题
      （半导体/集成电路/AI/智能化/服务器/供应链/物流/仓储），每条都保留来源 + 原文链接。
   2) 新增 server `/api/learning/today|recent|by-cat`：实时读 learning/YYYY-MM-DD.json
      （手工 seed 的 9/2 包共 15 条覆盖 8 个主题，PWA 进 tab 即拉）。 */
const C='gzt-v23';
const SHELL=['./','./index.html','./manifest.json','./icon-180.png','./icon-192.png','./icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});

/* 删除所有缓存里非同源的条目（历史遗留的 webhook 响应 / 跨域资源） */
async function purgeCrossOrigin(){
  try{
    const keys=await caches.keys();
    for(const k of keys){
      const c=await caches.open(k);
      const reqs=await c.keys();
      for(const r of reqs){
        try{
          if(new URL(r.url, self.location.href).origin !== self.location.origin){
            await c.delete(r);
          }
        }catch(_){}
      }
    }
  }catch(_){}
}

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    try{
      const keys=await caches.keys();
      await Promise.all(keys.map(k=>caches.delete(k)));
    }catch(_){}
    await purgeCrossOrigin();
    await self.clients.claim();
  })());
});
self.addEventListener('message',e=>{ if(e.data==='SKIP_WAITING') self.skipWaiting(); });

function isNav(req){
  return req.mode==='navigate' || (req.method==='GET' && (req.headers.get('accept')||'').indexOf('text/html')>-1);
}
function isData(req){
  try{
    var p=new URL(req.url).pathname;
    var f=p.substring(p.lastIndexOf('/')+1);
    return f.indexOf('data.')===0 && f.slice(-5)==='.json';
  }catch(_){ return false; }
}
function normKey(req){
  return isData(req) ? new Request('./data.v9.json') : req;
}
function isCross(req){
  try{ return new URL(req.url, self.location.href).origin !== self.location.origin; }catch(_){ return false; }
}

function networkFirst(req){
  return fetch(req).then(function(res){
    if(res && res.ok){
      var copy=res.clone();
      caches.open(C).then(function(c){ c.put(normKey(req),copy); }).catch(function(){});
    }
    return res;
  }).catch(function(){
    return caches.match(normKey(req)).then(function(r){
      return r || caches.match('./index.html');
    });
  });
}
function cacheFirst(req){
  return caches.match(req).then(function(r){
    return r || fetch(req).then(function(res){
      if(res && res.ok){
        var copy=res.clone();
        caches.open(C).then(function(c){ c.put(req,copy); }).catch(function(){});
      }
      return res;
    });
  });
}
self.addEventListener('fetch',function(e){
  var req=e.request;
  if(req.method!=='GET') return;
  /* 跨域请求一律不拦截，浏览器原生网络栈直传（含每日一学的 /api/learning/today 与 V9.1 直写通道） */
  if(isCross(req)) return;
  if(isData(req)){
    e.respondWith(fetch(req.clone(),{cache:'no-store'}).catch(function(){return fetch(req);}));
    return;
  }
  if(isNav(req)){ e.respondWith(networkFirst(req)); return; }
  e.respondWith(cacheFirst(req));
});
