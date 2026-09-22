/* sw.v85.js - PWA Service Worker（沿用 network-first 策略，HTML 防版本死锁）

   关键教训（v64→v65 卡死事件）：
   旧版 SW 对 HTML 走 cache-first，返回的永远是缓存里的旧 index.html，
   而那份 HTML 写死 register('sw.vNN.js') → 浏览器永远拿不到新 SW → 死锁。
   v66 起：HTML / 导航请求一律 network-first（先走网络，失败才回退缓存），
   这样每次刷新都能拿到最新 HTML → 里面注册最新 SW → 自动升级。

   其他策略：
   - data.v9.json：永远 networkOnly（业务数据必须最新）
   - 静态资源（js/css/img）：cache-first（省流量）*/
const C='gzt-v85';
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
  var req=e.request;
  if(req.method!=='GET') return;
  var url=new URL(req.url);
  if(url.origin!==location.origin) return;
  var path=url.pathname;
  /* HTML / 导航：network-first */
  if(req.mode==='navigate' || path.endsWith('/') || path.endsWith('index.html')){
    e.respondWith(
      fetch(req).then(function(res){ return res; }).catch(function(){
        return caches.match(req).then(function(r){ return r || new Response('离线不可用',{status:503}); });
      })
    );
    return;
  }
  /* 业务数据：永远走网络 */
  if(path.endsWith('data.v9.json') || path.indexOf('/api/')>=0){
    return;
  }
  /* 静态资源：cache-first，并后台更新 */
  e.respondWith(
    caches.match(req).then(function(cached){
      var net=fetch(req).then(function(res){
        if(res && res.status===200){ var cp=res.clone(); caches.open(C).then(function(c){c.put(req,cp)}); }
        return res;
      });
      return cached || net;
    })
  );
});
