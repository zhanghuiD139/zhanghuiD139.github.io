/* sw.v64.js - PWA Service Worker */
const C='gzt-v64';
const ASSETS=['./','./index.html','./manifest.json','./data.v9.json'];
self.addEventListener('install',function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(C).then(function(c){return c.addAll(ASSETS)}).catch(()=>{}));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){return k!==C && /^gzt-v/.test(k)}).map(function(k){return caches.delete(k)}));
  }).then(function(){return self.clients.claim()}));
});
self.addEventListener('fetch',function(e){
  var url=new URL(e.request.url);
  if(url.pathname.endsWith('/data.v9.json')){
    e.respondWith(fetch(e.request,{cache:'no-store'}));
    return;
  }
  if(e.request.method!=='GET') return;
  e.respondWith(
    caches.match(e.request).then(function(r){
      return r || fetch(e.request).then(function(resp){
        if(resp.ok && (url.origin===self.location.origin)){
          var clone=resp.clone();
          caches.open(C).then(function(c){c.put(e.request,clone)});
        }
        return resp;
      }).catch(function(){return caches.match('./index.html')});
    })
  );
});
