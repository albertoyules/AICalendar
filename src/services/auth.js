import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as cerrarSesionFirebase,
} from 'firebase/auth';

import { auth, hayFirebase } from '../config/firebase';

/**
 * Entrar con Google y nada más.
 *
 * Es una agenda personal: no hay registro, ni contraseñas que recordar, ni
 * verificación por correo. Un botón y dentro. Y como el identificador de
 * usuario es el de Google, entrar desde el móvil te da la misma agenda que
 * tienes en el ordenador sin hacer nada.
 */
export async function entrarConGoogle() {
  const proveedor = new GoogleAuthProvider();
  // Sin esto, Google salta el selector si ya hay una sesión iniciada en el
  // navegador y no te deja elegir con qué cuenta entrar.
  proveedor.setCustomParameters({ prompt: 'select_account' });
  const { user } = await signInWithPopup(auth, proveedor);
  return user;
}

export function cerrarSesion() {
  return cerrarSesionFirebase(auth);
}

/** El idToken de la sesión actual, para autenticar llamadas al servidor. */
export function idTokenActual() {
  return auth.currentUser?.getIdToken() ?? Promise.resolve(null);
}

/** Avisa de los cambios de sesión. Devuelve la función para dejar de escuchar. */
export function observarSesion(alCambiar) {
  if (!hayFirebase) {
    // Sin Firebase no hay sesión que observar: modo local, entras directo.
    alCambiar(null);
    return () => {};
  }
  return onAuthStateChanged(auth, alCambiar);
}
