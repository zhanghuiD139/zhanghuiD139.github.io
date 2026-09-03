/* offline shell · v27（v26 基础上只升版本号，强制用户拉到新 index.html）
   本次重点：默认行为更克制
   1) 业务数据·出入库页「出入库时间查询」details 默认折叠（state.v9ioOpen=false），需要时点 summary 自开
   2) 详情查询「模式」默认「内贸」（state.qDetailMode='内贸'），选项顺序也调整：内贸在前，外贸（J）在后
   列：仓库 / 单价（元）/ 单价（$）/ 当前库存 / 入总 / 出总 / 入金额 / 出金额 */
const C='gzt-v27';
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
