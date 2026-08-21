/**
 * Acceso de administrador a Firebase, solo para el servidor.
 *
 * A diferencia del cliente (que entra con la sesión de Google y las reglas
 * de Firestore le dejan ver solo lo suyo), esto entra con una cuenta de
 * servicio y se salta las reglas por completo. Por eso vive únicamente aquí,
 * nunca en src/, y la credencial nunca lleva prefijo VITE_.
 */
import admin from 'firebase-admin';

let app = null;

export function firebaseAdmin() {
  if (app) return app;

  const bruto = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!bruto) {
    throw new Error(
      'Falta FIREBASE_SERVICE_ACCOUNT. Pega ahí el JSON completo de la cuenta de servicio ' +
        '(Firebase Console > Configuración del proyecto > Cuentas de servicio > Generar nueva clave privada).',
    );
  }

  let credenciales;
  try {
    credenciales = JSON.parse(bruto);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT no es JSON válido. Pega el fichero descargado tal cual, sin tocarlo.');
  }

  app = admin.initializeApp({ credential: admin.credential.cert(credenciales) });
  return app;
}
