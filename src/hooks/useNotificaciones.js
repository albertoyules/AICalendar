import { useCallback, useEffect, useState } from 'react';
import { doc, deleteDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

import { clavePush, configFirebase, firestore, hayFirebase } from '../config/firebase';
import { pitido } from '../lib/sonido';

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

function refDispositivo(uid) {
  return doc(firestore, 'usuarios', uid, 'dispositivos', idDispositivo());
}

/** Mensajes concretos para los fallos que de verdad pasan, no solo "algo ha ido mal". */
function explicarFalloDeActivacion(fallo) {
  if (fallo?.name === 'AbortError' || /registro del service worker|register/i.test(fallo?.message ?? '')) {
    return 'No se ha podido instalar el service worker. Si usas un bloqueador de anuncios o de rastreo, prueba a desactivarlo para este sitio.';
  }
  if (fallo?.code === 'messaging/permission-blocked') {
    return 'El navegador ha bloqueado el permiso justo al pedir el token. Actívalo desde los ajustes del sitio y vuelve a intentarlo.';
  }
  if (fallo?.code === 'messaging/token-subscribe-failed' || fallo?.code === 'messaging/invalid-vapid-key') {
    return 'Firebase ha rechazado la clave VAPID. Revisa VITE_FIREBASE_VAPID_KEY: tiene que ser la de este mismo proyecto de Firebase.';
  }
  return 'No se ha podido activar. Vuelve a intentarlo; si sigue fallando, mira la consola del navegador (F12) para más detalle.';
}

/**
 * Notificaciones push.
 *
 * Pedir permiso exige un gesto del usuario — no se puede pedir solo al
 * cargar, el navegador lo ignora o lo bloquea. Por eso esto expone
 * `pedirPermiso()` para un botón, no algo que se dispare al montar.
 *
 * `registrado` (si este dispositivo tiene de verdad un token guardado) es
 * deliberadamente distinto de `permiso` (si el navegador concedió el
 * permiso): son cosas separadas. El permiso se puede conceder y aun así
 * fallar el paso siguiente — instalar el service worker, conseguir el
 * token, guardarlo en Firestore — y si el icono solo mirara el permiso,
 * se vería "activado" aunque ese fallo hubiera pasado en silencio.
 *
 * En iPhone, además, esto solo funciona si la web está instalada en la
 * pantalla de inicio (iOS 16.4+) — Safari normal nunca entrega push. No hay
 * forma de detectarlo de antemano ni de explicarlo mejor que dejar que el
 * propio Safari se niegue a conceder el permiso.
 */
export function useNotificaciones(usuario) {
  const [permiso, setPermiso] = useState(() => (SOPORTADO ? Notification.permission : 'unsupported'));
  const [registrado, setRegistrado] = useState(false);
  const [activando, setActivando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // El permiso lo puede cambiar el usuario desde fuera (ajustes del
    // sistema); al volver a la pestaña, que la interfaz se entere.
    const alVolver = () => SOPORTADO && setPermiso(Notification.permission);
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, []);

  // Al entrar (o recargar), si el permiso ya estaba concedido de una sesión
  // anterior, comprobamos si este dispositivo concreto sigue teniendo su
  // token guardado — así el icono no miente sobre lo que hay de verdad.
  useEffect(() => {
    if (!SOPORTADO || !hayFirebase || !usuario || permiso !== 'granted') {
      setRegistrado(false);
      return undefined;
    }
    let vivo = true;
    getDoc(refDispositivo(usuario.uid))
      .then((snap) => vivo && setRegistrado(snap.exists()))
      .catch(() => vivo && setRegistrado(false));
    return () => {
      vivo = false;
    };
  }, [usuario, permiso]);

  // Firebase entrega los avisos de dos formas distintas según si la pestaña
  // está en primer plano o no: en segundo plano (o cerrada) los recoge el
  // service worker (ver firebase-messaging-sw.js), pero en primer plano el
  // SDK los manda aquí, a onMessage() — y sin escucharlo, se pierden en
  // silencio. Por eso el dispositivo desde el que arrancas algo (el que
  // seguramente tienes con la pestaña abierta y mirando) podía parecer que
  // no avisaba, mientras que el resto sí sonaban.
  //
  // El mensaje viaja entero en `data` (nada en `notification`, ver
  // api/_avisos.js) a propósito: con `notification` de por medio, el
  // navegador podía mostrarlo solo Y este handler mostrarlo otra vez —
  // doble aviso en primer plano. Con solo `data` este es el único sitio que
  // decide mostrarlo en primer plano.
  useEffect(() => {
    if (!SOPORTADO || !hayFirebase || permiso !== 'granted') return undefined;
    return onMessage(getMessaging(), (payload) => {
      const titulo = payload.data?.titulo ?? 'IA Calendar';
      const cuerpo = payload.data?.cuerpo;
      pitido();
      new Notification(titulo, {
        body: cuerpo,
        icon: '/iconos/icono-192.png',
        tag: payload.data?.tipo ?? 'aviso',
      });
    });
  }, [permiso]);

  const pedirPermiso = useCallback(async () => {
    if (!SOPORTADO) {
      setError('Este navegador no admite avisos push.');
      return;
    }
    if (!hayFirebase || !clavePush) {
      setError('Falta la clave VAPID de Firebase (VITE_FIREBASE_VAPID_KEY). Sin ella no hay avisos.');
      return;
    }
    if (!usuario) {
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
        refDispositivo(usuario.uid),
        { token, agente: navigator.userAgent.slice(0, 140), actualizadoEn: serverTimestamp() },
        { merge: true },
      );
      setRegistrado(true);
    } catch (fallo) {
      console.error('[IA Calendar] notificaciones:', fallo);
      setError(explicarFalloDeActivacion(fallo));
      setRegistrado(false);
    } finally {
      setActivando(false);
    }
  }, [usuario]);

  /** No se puede revocar el permiso del navegador desde JS: solo dejamos de mandarle avisos a este dispositivo. */
  const desactivar = useCallback(async () => {
    if (!usuario) return;
    try {
      await deleteDoc(refDispositivo(usuario.uid));
      setRegistrado(false);
    } catch (fallo) {
      console.error('[IA Calendar] no se ha podido desactivar:', fallo);
    }
  }, [usuario]);

  return {
    soportado: SOPORTADO,
    activa: registrado,
    bloqueada: permiso === 'denied',
    activando,
    error,
    pedirPermiso,
    desactivar,
    descartarError: () => setError(null),
  };
}
