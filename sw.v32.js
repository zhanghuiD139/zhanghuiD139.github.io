/* offline shell · v31（v30 基础上只升版本号，强制用户拉到新 index.html）
   本次重点：修复出入库预通知"保存后数量/日期被清空" bug
   根因：ionCollect() 调 _ionRenderRows() 重建 DOM，但 input 没有 oninput 同步，
        重建会用旧的 _IO_NOTICE_ROWS 覆盖用户输入，导致 ionCollect 拿到空值
   修复：
   1) 新增 _ionSyncField(el) — input/select oninput 实时回写 _IO_NOTICE_ROWS
   2) _ionRenderRows() 改"渲染前先同步 DOM → 数组"双保险
   3) ionSave() 改成"绿色已保存面板 + 3.5s 后恢复空表单"，避免误以为数据丢了
   4) 加「+ 再录一条」按钮，立即清空继续录下一条 */
const C='gzt-v32';
const SHELL=['./','./index.html','./manifest.json','./icon-180.png','./icon-192.png','./icon-512.png'];
   本次重点：详情表格表头/数据彻底齐整
   1) cellTh：th 与 td 完全统一 padding(10px 4px) / font-size(13.5px) / line-height(1.2) / border-bottom(dashed)，font-weight(600→500) 弱化视觉分层，不让字号差异拉断列内 baseline
   2) tdBase：补 line-height:1.2 + 末尾;，跟 th 行高一致（防止 middlecolor 吞 color 复发）
   3) 「个」单位 span：font-size 11.5→12px + vertical-align:baseline + line-height:1，跟数字列同基线
   列：仓库 / 单价（元）/ 单价（$）/ 当前库存 / 入总 / 出总 / 入金额 / 出金额 */
const C='gzt-v30';
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
