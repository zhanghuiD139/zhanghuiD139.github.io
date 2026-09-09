/* offline shell - v57（每30分钟自动同步 + 手动立即同步）（data.v9.json 走 networkOnly 不缓存，每次拉线上最新）（项目号去前导0 + 合同号子串模糊搜索多匹配弹窗选）（司机信息去掉司机：前缀）（预通知卡片 kv 超宽自动换行，不再被省略号截断）（合同详情币种纯净：USD只显示$，CNY只显示¥，去掉所有换算副标）（新增出入流程接入结果弹窗 + 网络瞬断重试 + 自检 250ms 间隔）（写入可靠性：客户端排障上报 + 自检探针）（v42 基础上只升版本号，强制用户拉到新 index.html）
   本次：账号体系安全收口——出厂内置直写令牌撤销，登录改走服务端 auth.json（主人：张辉/同事：受限账号），在线操作带 Bearer 会话；受限账号只录不改不删；服务端写操作全审计 */
const C='gzt-v57';
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
