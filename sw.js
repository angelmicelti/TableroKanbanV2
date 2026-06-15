const CACHE_NAME = 'kanban-pwa-v30';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icons/favicon.svg',
  './splash/splash-design.svg',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './icons/icon-152x152.png',
  './js/main.js',
  './js/config.js',
  './js/utils.js',
  './js/state.js',
  './js/firebase-service.js',
  './js/tasks.js',
  './js/import-export.js',
  './js/pwa.js',
  './js/boards.js',
  './js/auth.js'
];

// Install event - cache core files
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Cache abierta');
        return cache.addAll(urlsToCache);
      })
      .catch(function(error) {
        // Si falla el precache, no bloqueamos la instalación del SW.
        // El fetch handler seguirá cacheando bajo demanda.
        console.error('Error al precachear:', error);
      })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('Eliminando cache antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - Network first, fallback to cache.
//   - Solo se interceptan peticiones GET (POST/PUT etc. no son cacheables
//     y pueden lanzar error si se hace caches.match sobre ellas).
//   - Las navegaciones offline reciben index.html como fallback para que
//     la PWA siga funcionando sin red.
self.addEventListener('fetch', function(event) {
  // Ignorar peticiones que no sean http/https (como chrome-extension://)
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // Fallback de navegación: si la red falla, servir index.html cacheado
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(function() {
        return caches.match('./index.html');
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // Cachear solo respuestas válidas del mismo origen
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(function() {
        return caches.match(event.request);
      })
  );
});
