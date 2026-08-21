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

import { MODELO } from './_cerebro.js';

function revisarClave() {
  const bruta = process.env.ANTHROPIC_API_KEY;

  if (!bruta) {
    return {
      estado: 'FALTA',
      pista: 'Añade ANTHROPIC_API_KEY en Vercel (Settings > Environment Variables) y vuelve a desplegar. Sin prefijo VITE_.',
    };
  }
  // Un espacio o un salto de línea al copiar es la causa más habitual de que
  // una clave correcta sea rechazada, y no se ve mirando el panel.
  if (bruta !== bruta.trim()) {
    return {
      estado: 'CON ESPACIOS',
      pista: 'La clave tiene espacios o un salto de línea al principio o al final. Vuelve a pegarla limpia.',
    };
  }
  if (!bruta.startsWith('sk-ant-')) {
    return {
      estado: 'RARA',
      pista: 'No empieza por sk-ant-. ¿Seguro que has pegado la clave de Anthropic y no otra cosa?',
    };
  }
  return { estado: 'PRESENTE', longitud: bruta.length, empieza: 'sk-ant-…' };
}

/** Llamada mínima de verdad, para saber si Anthropic la acepta. */
async function probarClave() {
  try {
    await new Anthropic().messages.create({
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

export default async function handler(req, res) {
  const clave = revisarClave();
  const informe = {
    servidor: 'en pie',
    modelo: MODELO,
    clave,
  };

  // La prueba real solo bajo petición: cada llamada gasta (poquísimo, pero gasta).
  if (req.query?.probar === '1' && clave.estado === 'PRESENTE') {
    informe.prueba = await probarClave();
  } else if (clave.estado === 'PRESENTE') {
    informe.prueba = 'Añade ?probar=1 a la URL para comprobar que Anthropic la acepta.';
  }

  informe.todoBien =
    clave.estado === 'PRESENTE' && (informe.prueba?.estado ?? 'FUNCIONA') === 'FUNCIONA';

  res.setHeader('Cache-Control', 'no-store');
  res.status(informe.todoBien ? 200 : 503).json(informe);
}
