import { useCallback, useEffect, useState } from 'react';
import { doc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getMessaging, getToken } from 'firebase/messaging';

import { auth, clavePush, configFirebase, firestore, hayFirebase } from '../config/firebase';

const SOPORTADO =
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'Notification' in window;

export { SOPORTADO as hayNotificaciones };

const CLAVE_DISPOSITIVO = 'iacalendar.dispositivo';

/** Un id estable para este navegador. Así reescribir el token no crea duplicados. */
function idDispositivo() {
  let id = localStorage.getItem(CLAVE_DISPOSITIVO);
  if (!id) {
    id = `disp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(CLAVE_DISPOSITIVO, id);
  }
  return id;
}

/**
 * Notificaciones push.
 *
 * Pedir permiso exige un gesto del usuario — no se puede pedir solo al
 * cargar, el navegador lo ignora o lo bloquea. Por eso esto expone
 * `pedirPermiso()` para un botón, no algo que se dispare al montar.
 *
 * En iPhone, además, esto solo funciona si la web está instalada en la
 * pantalla de inicio (iOS 16.4+) — Safari normal nunca entrega push. No hay
 * forma de detectarlo de antemano ni de explicarlo mejor que dejar que el
 * propio Safari se niegue a conceder el permiso.
 */
export function useNotificaciones() {
  const [permiso, setPermiso] = useState(() => (SOPORTADO ? Notification.permission : 'unsupported'));
  const [activando, setActivando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // El permiso lo puede cambiar el usuario desde fuera (ajustes del
    // sistema); al volver a la pestaña, que la interfaz se entere.
    const alVolver = () => SOPORTADO && setPermiso(Notification.permission);
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, []);

  const pedirPermiso = useCallback(async () => {
    if (!SOPORTADO) {
      setError('Este navegador no admite avisos push.');
      return;
    }
    if (!hayFirebase || !clavePush) {
      setError('Falta la clave VAPID de Firebase (VITE_FIREBASE_VAPID_KEY). Sin ella no hay avisos.');
      return;
    }
    if (!auth.currentUser) {
      setError('Entra con tu cuenta antes de activar los avisos.');
      return;
    }

    setActivando(true);
    setError(null);
    try {
      const resultado = await Notification.requestPermission();
      setPermiso(resultado);
      if (resultado !== 'granted') return;

      // La config no es secreta (la protegen las reglas de Firestore, no
      // ocultarla), pero el SW es un fichero estático fuera del empaquetado
      // de Vite: así es como le llega sin duplicar el fichero por entorno.
      const parametros = new URLSearchParams(configFirebase);
      const registro = await navigator.serviceWorker.register(
        `/firebase-messaging-sw.js?${parametros}`,
      );

      const token = await getToken(getMessaging(), { vapidKey: clavePush, serviceWorkerRegistration: registro });
      if (!token) throw new Error('Firebase no ha devuelto un token.');

      await setDoc(
        doc(firestore, 'usuarios', auth.currentUser.uid, 'dispositivos', idDispositivo()),
        { token, agente: navigator.userAgent.slice(0, 140), actualizadoEn: serverTimestamp() },
        { merge: true },
      );
    } catch (fallo) {
      console.error('[IA Calendar] notificaciones:', fallo);
      setError('No se ha podido activar. Vuelve a intentarlo.');
      setPermiso(SOPORTADO ? Notification.permission : 'unsupported');
    } finally {
      setActivando(false);
    }
  }, []);

  /** No se puede revocar el permiso del navegador desde JS: solo dejamos de mandarle avisos a este dispositivo. */
  const desactivar = useCallback(async () => {
    if (!auth?.currentUser) return;
    try {
      await deleteDoc(doc(firestore, 'usuarios', auth.currentUser.uid, 'dispositivos', idDispositivo()));
    } catch (fallo) {
      console.error('[IA Calendar] no se ha podido desactivar:', fallo);
    }
  }, []);

  return {
    soportado: SOPORTADO,
    activa: permiso === 'granted',
    bloqueada: permiso === 'denied',
    activando,
    error,
    pedirPermiso,
    desactivar,
    descartarError: () => setError(null),
  };
}
