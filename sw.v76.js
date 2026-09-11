/* sw.v76.js - PWA Service Worker（沿用 network-first 策略，HTML 防版本死锁）

   关键教训（v64→v65 卡死事件）：
   旧版 SW 对 HTML 走 cache-first，返回的永远是缓存里的旧 index.html，
   而那份 HTML 写死 register('sw.vNN.js') → 浏览器永远拿不到新 SW → 死锁。
   v66 起：HTML / 导航请求一律 network-first（先走网络，失败才回退缓存），
   这样每次刷新都能拿到最新 HTML → 里面注册最新 SW → 自动升级。

   其他策略：
   - data.v9.json：永远 networkOnly（业务数据必须最新）
   - 静态资源（js/css/img）：cache-first（省流量）*/
const C='gzt-v76';
self.addEventListener('install',function(e){
  self.skipWaiting();
});
self.addEventListener('activate',function(e){
  e.waitUntil(
    caches.keys().then(function(ks){
      return Promise.all(ks.filter(function(k){return k!==C && /^gzt-v/.test(k)}).map(function(k){return caches.delete(k)}));
    }).then(function(){return self.clients.claim()})
  );
});
self.addEventListener('fetch',function(e){
  var req=e.request, url=new URL(req.url);

  /* 1) 业务数据：永远走网络，绝不缓存 */
  if(url.pathname.endsWith('/data.v9.json')){
    e.respondWith(fetch(req,{cache:'no-store'}));
    return;
  }
  if(req.method!=='GET') return;

  /* 2) HTML / 导航请求：network-first（防版本死锁） */
  var isHtml = req.mode==='navigate' || (req.headers.get('accept')||'').indexOf('text/html')>-1;
  if(isHtml){
    e.respondWith(
      fetch(req,{cache:'no-store'}).then(function(resp){
        if(resp && resp.ok){
          try{ var c=resp.clone(); caches.open(C).then(function(x){x.put(req,c)}); }catch(err){}
        }
        return resp;
      }).catch(function(){
        return caches.match(req).then(function(r){
          return r || caches.match('./index.html');
        });
      })
    );
    return;
  }

  /* 3) 静态资源：cache-first */
  e.respondWith(
    caches.match(req).then(function(r){
      return r || fetch(req).then(function(resp){
        if(resp.ok && url.origin===self.location.origin){
          try{ var c=resp.clone(); caches.open(C).then(function(x){x.put(c)}); }catch(err){}
        }
        return resp;
      });
    })
  );
});
