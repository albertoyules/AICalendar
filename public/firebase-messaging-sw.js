/**
 * El service worker.
 *
 * Firebase espera este fichero con este nombre exacto en la raíz: es lo que
 * busca solo, sin más configuración, cuando el cliente pide un token. Vive en
 * public/ porque Vite lo copia tal cual a la raíz del sitio compilado — un
 * service worker no pasa por el empaquetado normal.
 *
 * Solo hace dos cosas: recibir el aviso cuando la app está cerrada, y abrirla
 * al tocarlo. Nada de caché ni modo sin conexión — no se ha pedido, y una
 * caché mal invalidada es peor que no tener caché.
 */
importScripts('https://www.gstatic.com/firebasejs/11.1.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.1.0/firebase-messaging-compat.js');

// La config de Firebase no es secreta — igual que en el cliente, la protegen
// las reglas de Firestore, no ocultarla. Aun así no viaja como texto suelto:
// el propio registro del SW hace de "instalador", que la pasa por la URL.
const parametros = new URL(self.location).searchParams;
firebase.initializeApp({
  apiKey: parametros.get('apiKey'),
  authDomain: parametros.get('authDomain'),
  projectId: parametros.get('projectId'),
  messagingSenderId: parametros.get('messagingSenderId'),
  appId: parametros.get('appId'),
});

const messaging = firebase.messaging();

// Con la app cerrada o en segundo plano, el navegador entrega aquí el aviso.
// Con la app abierta y en primer plano, este handler no se dispara — eso lo
// gestiona onMessage() en el propio cliente (useNotificaciones.js).
messaging.onBackgroundMessage(({ notification, data }) => {
  self.registration.showNotification(notification?.title ?? 'IA Calendar', {
    body: notification?.body,
    icon: '/iconos/icono-192.png',
    badge: '/iconos/icono-192.png',
    tag: data?.tipo ?? 'aviso', // un aviso nuevo del mismo tipo sustituye al anterior, no se amontonan
    data,
  });
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  evento.waitUntil(
    (async () => {
      const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const abierta = clientes.find((c) => c.url.includes(self.location.origin));
      if (abierta) return abierta.focus();
      return self.clients.openWindow('/');
    })(),
  );
});
