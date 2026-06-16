// Service Worker mínimo — habilita instalação como PWA.
// Sem cache offline pesado: o app sempre precisa de internet pra funcionar
// (conforme decisão do projeto), então só fazemos um pass-through das requisições.

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  // Pass-through simples: sempre busca da rede, sem interceptar/cachear nada.
  event.respondWith(fetch(event.request))
})
