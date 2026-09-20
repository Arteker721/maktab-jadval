// ============ CACHE VERSIYASI ============
const CACHE_NAME = 'maktab-jadval-v1';

// ============ KESHLANADIGAN FAYLLAR ============
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/icon.svg',
  '/manifest.json'
];

// ============ O'RNATISH ============
self.addEventListener('install', (event) => {
  console.log('📦 Service Worker: o\'rnatilmoqda...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 Fayllar keshlanmoqda');
      return cache.addAll(FILES_TO_CACHE).catch((err) => {
        console.warn('⚠️ Ba\'zi fayllar keshlanmadi:', err);
      });
    })
  );
  self.skipWaiting();
});

// ============ FAOLLASHTIRISH ============
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker: faollashtirildi');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('🗑️ Eski kesh o\'chirilmoqda:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ============ SO'ROVLARNI USHLASH ============
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API so'rovlarni keshlamaymiz — har doim serverdan
  if (url.pathname.startsWith('/api/')) {
    return; // Oddiy fetch ishlaydi
  }

  // Faqat GET so'rovlarni keshlaymiz
  if (request.method !== 'GET') return;

  // Network First: avval serverdan, keyin keshdan
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Muvaffaqiyatli javobni keshga saqlaymiz
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone).catch(() => {});
          });
        }
        return response;
      })
      .catch(() => {
        // Internet yo'q — keshdan qaytaramiz
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // Agar sahifa so'ralsa — index.html qaytaramiz
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});