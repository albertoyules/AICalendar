/**
 * Diagnóstico de la configuración del servidor.
 *
 * Abrir /api/salud en el navegador dice si las variables de entorno están
 * bien puestas, sin enseñar ningún valor. Nunca devuelve la clave: solo si
 * está, si tiene la pinta correcta y si Anthropic la acepta.
 *
 * Las variables VITE_ no salen aquí y no es un olvido: se incrustan en el
 * JavaScript al compilar y esta función no llega a verlas. Para comprobar
 * esas, mira la propia app (lo explica el README).
 */
import Anthropic from '@anthropic-ai/sdk';

import { MODELO, claveLimpia } from './_cerebro.js';
import { firebaseAdmin } from './_admin.js';

function revisarClave() {
  const bruta = process.env.ANTHROPIC_API_KEY;

  if (!bruta) {
    return {
      estado: 'FALTA',
      pista: 'Añade ANTHROPIC_API_KEY en Vercel (Settings > Environment Variables) y vuelve a desplegar. Sin prefijo VITE_.',
    };
  }
  // Un espacio o un salto de línea al copiar ya no rompe nada —el servidor la
  // limpia— pero se avisa igual, por si esconde otro error al pegarla.
  const nota =
    bruta !== bruta.trim()
      ? 'Venía con espacios o un salto de línea al pegarla. Se limpian solos, así que funciona igual; puedes dejarla como está.'
      : undefined;

  const limpia = bruta.trim();
  if (!limpia.startsWith('sk-ant-')) {
    return {
      estado: 'RARA',
      pista: 'No empieza por sk-ant-. ¿Seguro que has pegado la clave de Anthropic y no otra cosa?',
    };
  }
  return { estado: 'PRESENTE', longitud: limpia.length, empieza: 'sk-ant-…', nota };
}

/** Llamada mínima de verdad, para saber si Anthropic la acepta. */
async function probarClave() {
  try {
    await new Anthropic({ apiKey: claveLimpia() }).messages.create({
      model: MODELO,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hola' }],
    });
    return { estado: 'FUNCIONA' };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { estado: 'RECHAZADA', pista: 'Anthropic no acepta esta clave. ¿Está revocada o mal copiada?' };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { estado: 'FUNCIONA', nota: 'Válida, pero ahora mismo hay límite de peticiones.' };
    }
    if (error?.status === 400 && /model/i.test(error?.message ?? '')) {
      return { estado: 'MODELO MALO', pista: `Anthropic no conoce el modelo "${MODELO}". Revisa ANTHROPIC_MODEL.` };
    }
    return { estado: 'ERROR', pista: error?.message?.slice(0, 160) ?? 'Fallo desconocido.' };
  }
}

/** ¿Está el JSON de la cuenta de servicio y tiene la forma que se espera? */
function revisarCuentaDeServicio() {
  const bruta = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!bruta) {
    return {
      estado: 'FALTA',
      pista:
        'Añade FIREBASE_SERVICE_ACCOUNT en Vercel con el JSON completo (Firebase Console > Configuración del proyecto > Cuentas de servicio > Generar nueva clave privada). Pega el fichero tal cual, sin prefijo VITE_.',
    };
  }
  let datos;
  try {
    datos = JSON.parse(bruta);
  } catch {
    return { estado: 'JSON INVÁLIDO', pista: 'No se puede leer como JSON. Pega el fichero descargado entero, sin recortar ni reformatear.' };
  }
  if (!datos.project_id || !datos.private_key || !datos.client_email) {
    return { estado: 'INCOMPLETA', pista: 'Le faltan campos (project_id, private_key o client_email). ¿Es el JSON de cuenta de servicio correcto?' };
  }
  return { estado: 'PRESENTE', proyecto: datos.project_id, cuenta: datos.client_email };
}

/** Inicializa de verdad y hace una lectura mínima, para saber si Firestore la acepta. */
async function probarCuentaDeServicio() {
  try {
    firebaseAdmin();
    const admin = (await import('firebase-admin')).default;
    await admin.firestore().collection('usuarios').limit(1).get();
    return { estado: 'FUNCIONA' };
  } catch (error) {
    return { estado: 'ERROR', pista: error?.message?.slice(0, 200) ?? 'Fallo desconocido.' };
  }
}

function revisarCronSecret() {
  const bruto = process.env.CRON_SECRET;
  if (!bruto) {
    return { estado: 'FALTA', pista: 'Añade CRON_SECRET en Vercel — cualquier texto aleatorio de 16+ caracteres. Sin él, los avisos programados no pueden ejecutarse.' };
  }
  if (bruto.trim().length < 16) {
    return { estado: 'CORTO', pista: 'Con menos de 16 caracteres es fácil de adivinar. Genera uno más largo.' };
  }
  return { estado: 'PRESENTE', longitud: bruto.trim().length };
}

export default async function handler(req, res) {
  const probar = req.query?.probar === '1';

  const clave = revisarClave();
  const cuentaDeServicio = revisarCuentaDeServicio();
  const cronSecret = revisarCronSecret();

  const informe = {
    servidor: 'en pie',
    modelo: MODELO,
    clave,
    avisosPush: { cuentaDeServicio, cronSecret },
  };

  // La prueba real solo bajo petición: cada llamada gasta (poquísimo, pero gasta).
  if (probar && clave.estado === 'PRESENTE') {
    informe.prueba = await probarClave();
  } else if (clave.estado === 'PRESENTE') {
    informe.prueba = 'Añade ?probar=1 a la URL para comprobar que Anthropic la acepta.';
  }
  if (probar && cuentaDeServicio.estado === 'PRESENTE') {
    informe.avisosPush.prueba = await probarCuentaDeServicio();
  } else if (cuentaDeServicio.estado === 'PRESENTE') {
    informe.avisosPush.prueba = 'Añade ?probar=1 para comprobar que Firestore acepta la cuenta de servicio.';
  }

  informe.todoBien =
    clave.estado === 'PRESENTE' && (informe.prueba?.estado ?? 'FUNCIONA') === 'FUNCIONA';

  res.setHeader('Cache-Control', 'no-store');
  res.status(informe.todoBien ? 200 : 503).json(informe);
}
