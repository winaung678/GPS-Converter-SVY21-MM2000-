const CACHE_NAME = 'survey-pro-cache-v2';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './leaflet.css',
  './leaflet.js',
  './formulas.js',
  './globals.js',
  './map_engine.js',
  './app_conversions.js',
  './app_survey_tools.js',
  './app_camera.js',
  './app_logic.js',
  './egm2008_1min.bin',
  './egm96_global.bin',
  './icon-192.png',
  './icon-512.png',
  'https://unpkg.com/dxf-parser/dist/dxf-parser.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache ထဲမှာရှိရင် အဲ့ဒါကို ပေးမယ် (Offline အလုပ်လုပ်မယ်)
        if (response) {
          return response;
        }
        // မရှိရင် အင်တာနက်ကနေ ဆွဲမယ်
        return fetch(event.request);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName); // Cache အဟောင်းတွေ ဖျက်မယ်
          }
        })
      );
    })
  );
});
