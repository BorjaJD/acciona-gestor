// Service Worker - Acciona Gestor
// Cachea el HTML para que funcione offline. Los datos vienen de Supabase + localStorage.

const CACHE_VERSION = 'acciona-v1.0.1';
const CACHE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

// Instalación: cachear archivos básicos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(CACHE_FILES))
      .catch(err => console.warn('SW install warning:', err))
  );
  self.skipWaiting();
});

// Activación: limpiar caches viejas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: estrategia "network-first" para HTML, "cache-first" para assets
self.addEventListener('fetch', event => {
  const req = event.request;
  
  // Solo manejar GET
  if(req.method !== 'GET') return;
  
  // No cachear llamadas a Supabase ni APIs externas (Anthropic, etc.)
  const url = new URL(req.url);
  if(url.host.includes('supabase.co') || 
     url.host.includes('anthropic.com') ||
     url.host.includes('googleapis.com') ||
     url.host.includes('google.com')) {
    return; // dejar que el navegador maneje normalmente
  }
  
  // Network-first para el HTML principal (siempre intentar la última versión)
  if(req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then(res => {
          // Cachear copia para uso offline
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  
  // Cache-first para assets (iconos, manifest)
  event.respondWith(
    caches.match(req).then(cached => {
      if(cached) return cached;
      return fetch(req).then(res => {
        if(res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
