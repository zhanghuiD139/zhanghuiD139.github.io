/* offline shell - v63（出入库时间查询：日期 input 改 onchange 写回 state 避免选仓库被清空 + 明细行点击跳合同详情）
   渐进说明：
     - v57: 每30分钟自动同步+手动立即同步；data.v9.json networkOnly
     - v58/v59: tunnel 连接复用坑——_ioFetch 统一封装（no-store+keepalive+450ms cache buster 重试）
     - v60: 预通知一步直写+全屏结果浮层弹窗
     - v61: 详情查询按产品分组合同数量读 sheet2 J「合同数量」
     - v62: 详情查询产品匹配空白字符规范化（去 \n / 多空格 / 全角空格）
     - v63: 出入库时间查询日期 input 加 onchange 写回 state（修"选仓库日期被清空"bug）；
            出入库明细行可点击跳合同详情（拆项目号 → 设 state.qDetail* → 调 qDetailRun → 滚到详情区顶部） */
const C='gzt-v63';
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
  /* 跨域请求一律不拦截，浏览器原生网络栈直传（含每日一学的 /api/learning/today 与 V9.1 直写通道 /api/v91/raw） */
  if(isCross(req)) return;
  if(isData(req)){
    /* v55：data.v9.json 走 networkOnly（不读缓存不写缓存），每次拿线上最新；
       URL 用字符串以确保 cache:'no-store' 生效（Request 对象 + init 在部分浏览器上被忽略） */
    var dataUrl=new URL(req.url).pathname+new URL(req.url).search;
    e.respondWith(fetch(dataUrl,{cache:'no-store',headers:{'Cache-Control':'no-cache'}}));
    return;
  }
  if(isNav(req)){ e.respondWith(networkFirst(req)); return; }
  e.respondWith(cacheFirst(req));
});
