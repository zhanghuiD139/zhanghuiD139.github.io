/* sw.v64.js — v66 自毁升级脚本（辉哥浏览器当前装的就是这个，改成自毁让他刷新后脱离 v64）

   死锁原理：旧 SW 走 cache-first，返回的永远是缓存里的 v64 index.html，
   而那份 HTML 里写的是 register('sw.v64.js')，于是永远升不上去。

   自毁流程（浏览器每次导航都会 byte-diff 检查已装 SW 脚本，发现变了就重装）：
   1. install: skipWaiting 立刻接管
   2. activate: 删光所有缓存 → 注销自己 → 强制所有页面 reload
   3. reload 后走纯网络 → 拿到最新 index.html（注册 sw.v66.js）→ 恢复正常 */
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(ks){
      return Promise.all(ks.map(function(k){ return caches.delete(k); }));
    }).then(function(){
      return self.registration.unregister();
    }).then(function(){
      return self.clients.claim();
    }).then(function(){
      return self.clients.matchAll({type:'window'});
    }).then(function(cls){
      cls.forEach(function(c){ try{ c.navigate(c.url); }catch(err){} });
    }).catch(function(){})
  );
});
/* 自毁期间一律走网络，绝不再吐任何缓存 */
self.addEventListener('fetch', function(e){
  if(e.request.method!=='GET') return;
  e.respondWith(fetch(e.request).catch(function(){ return Response.error(); }));
});
