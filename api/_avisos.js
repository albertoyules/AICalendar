/**
 * Mandar un push a todos los dispositivos de un usuario.
 *
 * Un usuario puede tener el Mac y el iPhone a la vez, cada uno con su propio
 * token en usuarios/{uid}/dispositivos. Se manda a todos en paralelo, y si
 * alguno ha dejado de existir (se desinstaló la app, se revocó el permiso),
 * se borra su token de paso — así la lista no se llena de dispositivos
 * muertos a los que nunca les va a llegar nada.
 */
import admin from 'firebase-admin';

import { firebaseAdmin } from './_admin.js';

const CODIGOS_TOKEN_MUERTO = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

export async function enviarATodosLosDispositivos(refUsuario, { titulo, cuerpo, tipo }) {
  firebaseAdmin();

  const dispositivos = await refUsuario.collection('dispositivos').get();
  if (dispositivos.empty) return 0;

  const resultados = await Promise.allSettled(
    dispositivos.docs.map((d) =>
      admin.messaging().send({
        token: d.data().token,
        notification: { title: titulo, body: cuerpo },
        // El icono, el badge y el agrupado (tag) los decide el propio
        // service worker al recibirlo — ver public/firebase-messaging-sw.js.
        data: { tipo },
      }),
    ),
  );

  await Promise.all(
    resultados.map((resultado, i) => {
      const codigo = resultado.status === 'rejected' ? resultado.reason?.errorInfo?.code : null;
      return CODIGOS_TOKEN_MUERTO.has(codigo) ? dispositivos.docs[i].ref.delete() : null;
    }),
  );

  return resultados.filter((r) => r.status === 'fulfilled').length;
}
