const staticCacheName = 'static-version2';
const dynamicCacheName = 'dynamic-version2';
const assets = [ 
  '/',
  '/home', 
  '/css/styles-home.css',
  '/css/styles-login.css',
  '/css/resets.css',
  '/login.html',
  '/home.html',
  '/auth.js',
  '/crypts.js',
  '/userlogin.js',
  '/home.js',
  '/images/bills.png',
  '/images/chart.png',
  '/images/entertainment.png',
  '/images/food.png',
  '/images/fuel.png',
  '/images/lodging.png',
  '/images/logo-sq.png',
  '/images/logout.png',
  '/images/other.png',
  '/images/settings.png',
  '/images/transport.png',
  '/images/medical.png',
  '/images/lifestyle.png',
  '/images/favicon.png',
  '/images/user.png',
  '/images/pending.png',
  '/images/rejected.png',
  '/images/approved.png',
  '/images/themeicon.png',
  '/images/history.png'
];

// install event
self.addEventListener('install', evt => {
  //console.log('service worker installed');
  evt.waitUntil(
    caches.open(staticCacheName).then((cache) => {
      console.log('caching shell assets');
      cache.addAll(assets);
    })
  );
});

// activate event
self.addEventListener('activate', evt => {
  //console.log('service worker activated');
  evt.waitUntil(
    caches.keys().then(keys => {
      //console.log(keys);
      return Promise.all(keys
        .filter(key => key !== staticCacheName && key !== dynamicCacheName)
        .map(key => caches.delete(key))
      );
    })
  );
});

// fetch event
self.addEventListener('fetch', evt => {
  //console.log('fetch event', evt);
  evt.respondWith(
    caches.match(evt.request).then(cacheRes => {
      return cacheRes || fetch(evt.request).then(fetchRes => {
        return caches.open(dynamicCacheName).then(cache => {
          cache.put(evt.request.url, fetchRes.clone());
          return fetchRes;
        })
      });
    })
  );
});