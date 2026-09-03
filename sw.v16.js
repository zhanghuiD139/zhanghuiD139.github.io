/* offline shell · v16（清掉 v15 及之前所有缓存；本次：V9.1「金山自动化 webhook」直写通道 —— 跨域请求一律放行）
   策略：页面(index.html)与 data.json 走「网络优先 / 直连网络」，保证每次部署都能拿到最新代码与数据；
        静态资源(图标/manifest/vendor OCR 引擎)走「缓存优先」，省流量。离线时回退缓存。
   文件名从 sw.v15.js 改为 sw.v16.js：旧 SW 缓存随之失效，强制全量重注册。 */
const C='gzt-v16';
const SHELL=['./','./index.html','./manifest.json','./icon-180.png','./icon-192.png','./icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  // 删除所有旧版本缓存（含 gzt-v1~v15 任意名），保证不残留冻结的旧 index.html / data.json
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('message',e=>{ if(e.data==='SKIP_WAITING') self.skipWaiting(); });

function isNav(req){
  return req.mode==='navigate' || (req.method==='GET' && (req.headers.get('accept')||'').indexOf('text/html')>-1);
}
/* 数据文件已改名为 data.v9.json（绕开所有旧路径级缓存：SW/HTTP/CDN/localStorage）。
   这里用「data. 开头 + .json 结尾」匹配，新旧文件名都能命中 network-only。 */
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
  try{ return new URL(req.url).origin !== self.location.origin; }catch(_){ return false; }
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
     关键：V9.1「金山自动化 webhook」直写就是一次跨域 GET —— 若走 cacheFirst 被写进 Cache Storage，
     第二次相同 URL 会命中缓存而不再真发请求，金山流程就不会被触发（表现为「点了没写进去」）。 */
  if(isCross(req)) return;
  /* data.json：永远直连网络、不读不写缓存，保证返回线上最新值 */
  if(isData(req)){
    e.respondWith(fetch(req.clone(),{cache:'no-store'}).catch(function(){return fetch(req);}));
    return;
  }
  if(isNav(req)){ e.respondWith(networkFirst(req)); return; }
  e.respondWith(cacheFirst(req));
});
