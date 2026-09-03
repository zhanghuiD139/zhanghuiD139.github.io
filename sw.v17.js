/* offline shell · v17（清掉 v16 及之前所有缓存 + 主动清理历史残留的跨域缓存条目）
   本次重点：V9.1「金山自动化 webhook」直写是跨域 GET。
   旧版（≤v16 之前已安装的实例）会把这类响应写进 Cache Storage，
   导致「第一次真发、之后命中缓存不再真发」= V9.1 收不到记录。
   v17 做三层保险：
     ① fetch 里对跨域请求直接 return，交给浏览器原生网络栈，永不入缓存；
     ② activate 时删光所有旧缓存；
     ③ activate 时再遍历一遍所有缓存，删除任何非同源条目（历史残留兜底）。
   策略：页面(index.html)与 data.json 走「网络优先 / 直连网络」；静态资源走「缓存优先」。 */
const C='gzt-v17';
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
    // ① 删光所有旧版本缓存（含 gzt-v1~v16 任意名），保证不残留冻结的旧 index.html / data.json
    try{
      const keys=await caches.keys();
      await Promise.all(keys.map(k=>caches.delete(k)));
    }catch(_){}
    // ② 兜底：万一有删不掉的缓存，再逐个清掉非同源条目
    await purgeCrossOrigin();
    await self.clients.claim();
  })());
});
self.addEventListener('message',e=>{ if(e.data==='SKIP_WAITING') self.skipWaiting(); });

function isNav(req){
  return req.mode==='navigate' || (req.method==='GET' && (req.headers.get('accept')||'').indexOf('text/html')>-1);
}
/* 数据文件已改名为 data.v9.json（绕开所有旧路径级缓存）。 */
function isData(req){
  try{
    var p=new URL(req.url).pathname;
    var f=p.substring(p.lastIndexOf('/')+1);
    return f.indexOf('data.')===0 && f.slice(-5)==='.json';
  }catch(_){ return false; }
}
/* 数据文件去掉 ?t= 时间戳再存缓存，避免每次刷新都堆一份副本 */
function normKey(req){
  return isData(req) ? new Request('./data.v9.json') : req;
}
/* 是否跨域（金山自动化 webhook / v91-crud server 隧道地址都属于跨域） */
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
  /* 跨域请求一律不拦截，交给浏览器原生网络栈。
     关键：V9.1「金山自动化 webhook」直写就是跨域 GET —— 一旦被写进 Cache Storage，
     之后相同 URL 会命中缓存而不再真发请求，金山流程不再被触发（症状：第一次通、之后不通）。 */
  if(isCross(req)) return;
  /* data.json：永远直连网络、不读不写缓存，保证返回线上最新值 */
  if(isData(req)){
    e.respondWith(fetch(req.clone(),{cache:'no-store'}).catch(function(){return fetch(req);}));
    return;
  }
  if(isNav(req)){ e.respondWith(networkFirst(req)); return; }
  e.respondWith(cacheFirst(req));
});
