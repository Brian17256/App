const CACHE_NAME = 'habitflow-auto-update';

// Instalación: Forzamos a que el nuevo Service Worker tome el mando
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

// Activación: Limpieza y control inmediato
self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

// Estrategia: Intentar siempre descargar de internet para estar actualizado
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Si hay respuesta exitosa, guardamos una copia en el caché
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, resClone);
        });
        return res;
      })
      .catch(() => caches.match(e.request)) // Si no hay internet, usa el caché
  );
});
