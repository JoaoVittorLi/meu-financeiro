self.addEventListener('push',(event)=>{
  // Intentionally no financial details: this pilot proves background delivery with zero payload.
  event.waitUntil(self.registration.showNotification('💜 Meu Financeiro', {
    body:'Seu aviso de teste chegou! Notificações funcionando com o app fechado.',
    icon:'/icon-192.png', badge:'/icon-192.png', tag:'meu-financeiro-test',
    renotify:true, data:{url:'/'},
  }));
});
self.addEventListener('notificationclick',(event)=>{
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{
    const window=windows.find(w=>new URL(w.url).origin===self.location.origin);
    if(window) return window.focus();
    return clients.openWindow('/');
  }));
});
