/* offline shell · v29（v28 基础上只升版本号，强制用户拉到新 index.html）
   本次重点：出入库预通知功能（多产品行+司机信息+图片导出）+ 按钮改版（预出入/新增出入/出入库预通知，删识别录入）
   1) 预通知 form: ioNoticeForm() - 项目号/合同号/产品多行/仓库/日期数量/销售下家/司机信息/备注
   2) 自动联动: ionAutoFill() - 输入项目号/采购/销售合同号 → 自动带出产品/销售下家
   3) 图片导出: ionRenderCanvas() → dataURL → 保存或剪贴板复制（可粘微信）
   4) 保存至新增出入库: ionSave() → 写入本地 io + v9io_pending 队列 */
const C='gzt-v29';
const SHELL=['./','./index.html','./manifest.json','./icon-180.png','./icon-192.png','./icon-512.png'];
   本次重点：详情表格表头/数据彻底齐整
   1) cellTh：th 与 td 完全统一 padding(10px 4px) / font-size(13.5px) / line-height(1.2) / border-bottom(dashed)，font-weight(600→500) 弱化视觉分层，不让字号差异拉断列内 baseline
   2) tdBase：补 line-height:1.2 + 末尾;，跟 th 行高一致（防止 middlecolor 吞 color 复发）
   3) 「个」单位 span：font-size 11.5→12px + vertical-align:baseline + line-height:1，跟数字列同基线
   列：仓库 / 单价（元）/ 单价（$）/ 当前库存 / 入总 / 出总 / 入金额 / 出金额 */
const C='gzt-v28';
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
