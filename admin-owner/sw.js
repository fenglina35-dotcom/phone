const CACHE = 'north-admin-owner-v640';
const SHELL = ['./', './index.html', '../admin/app.js?v=640', './manifest.webmanifest', '../icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE && key.startsWith('north-admin-owner-')).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html'))));
});
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  const title = data.title || '新的付款核对申请';
  const options = {
    body: data.body || '点开主管理员总后台查看',
    icon: '../icon.png',
    badge: '../icon.png',
    tag: data.purchase_id ? 'order-' + data.purchase_id : 'north-payment',
    renotify: true,
    data: {url: data.url || './'},
  };
  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    self.registration.setAppBadge ? self.registration.setAppBadge() : Promise.resolve(),
  ]));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './', self.location.href).href;
  event.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then((clients) => {
    for (const client of clients) {
      if (client.url.startsWith(self.registration.scope)) {
        client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  }));
});
