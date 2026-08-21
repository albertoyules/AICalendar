/**
 * Arranque de Firebase.
 *
 * Si no hay credenciales en .env.local la app NO se rompe: el repositorio se
 * cae a localStorage y todo sigue funcionando en el navegador. Asi se puede
 * trastear con el calendario antes de tener el proyecto de Firebase montado.
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const hayFirebase = Boolean(config.apiKey && config.projectId);

let db = null;
let autenticacion = null;
if (hayFirebase) {
  const app = initializeApp(config);
  db = getFirestore(app);
  autenticacion = getAuth(app);
} else {
  console.info(
    '[IA Calendar] Sin credenciales de Firebase: guardando en el navegador. ' +
      'Copia .env.example a .env.local para conectar la base de datos real.',
  );
}

export const firestore = db;
export const auth = autenticacion;

/** La config completa, para pasársela al service worker de notificaciones. */
export const configFirebase = config;

/** La clave VAPID de Firebase Cloud Messaging. Sin ella no hay avisos push. */
export const clavePush = import.meta.env.VITE_FIREBASE_VAPID_KEY;
