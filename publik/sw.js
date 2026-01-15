const CACHE_NAME = 'asuma-cache-v2';
const OFFLINE_PAGE = '/index.html';

self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching App Shell');
        return cache.addAll([
          '/',
          '/index.html',
          '/manifest.json'
        ]).catch(error => {
          console.error('Failed to cache some resources:', error);
        });
      })
      .then(() => self.skipWaiting())
      .catch(error => {
        console.error('Service Worker installation failed:', error);
      })
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('Service Worker: Removing old cache', key);
            return caches.delete(key);
          })
      );
    }).then(() => {
      console.log('Service Worker: Claiming clients');
      return self.clients.claim();
    })
  );
});

self.addEventListener('push', event => {
  console.log('Service Worker: Push Received', event);
  
  let data = { 
    title: 'asuma Apis\'S', 
    body: 'Pesan baru dari asuma',
    icon: 'https://cdn.asuma.my.id/o8v8wq8x12.jpg',
    badge: 'https://cdn.asuma.my.id/o8v8wq8x12.jpg',
    url: '/'
  };
  
  if (event.data) {
    try {
      const jsonData = event.data.json();
      data = { ...data, ...jsonData };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    image: data.image,
    vibrate: [100, 50, 100],
    data: { url: data.url },
    actions: data.actions || [],
    tag: data.tag || 'default-tag',
    renotify: data.renotify || true,
    requireInteraction: data.requireInteraction || false
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .catch(error => console.error('Notification failed:', error))
  );
});

self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification Click');
  
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url === event.notification.data.url && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url || '/');
        }
      })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || 
      event.request.url.startsWith('chrome-extension://') ||
      event.request.url.includes('extension')) {
    return;
  }
  
  if (new URL(event.request.url).origin !== location.origin && 
      !event.request.url.includes('cdn.asuma.my.id')) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const cachedResponse = await caches.match(event.request);
        
        if (cachedResponse) {
          event.waitUntil(
            (async () => {
              try {
                const networkResponse = await fetch(event.request);
                if (networkResponse.ok) {
                  const cache = await caches.open(CACHE_NAME);
                  await cache.put(event.request, networkResponse.clone());
                }
              } catch (error) {
                console.debug('Background cache update failed:', error);
              }
            })()
          );
          return cachedResponse;
        }

        const networkResponse = await fetch(event.request);
        
        if (networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
        }
        
        return networkResponse;
      } catch (error) {
        console.log('Fetch failed; returning offline page.', error);
        
        if (event.request.headers.get('accept')?.includes('text/html')) {
          const cache = await caches.open(CACHE_NAME);
          const offlinePage = await cache.match(OFFLINE_PAGE);
          if (offlinePage) return offlinePage;
        }
        
        if (event.request.destination === 'image') {
          return caches.match('https://cdn.asuma.my.id/o8v8wq8x12.jpg');
        }
        
        return new Response('Offline - Silahkan cek koneksi internet', {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    })()
  );
});

self.addEventListener('sync', event => {
  if (event.tag === 'sync-messages') {
    console.log('Background sync triggered');
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  try {
    const cache = await caches.open(CACHE_NAME);
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

self.addEventListener('error', event => {
  console.error('Service Worker Error:', event.error);
});
