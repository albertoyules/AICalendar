/**
 * El cerebro, sin envoltorio.
 *
 * Aquí no hay Express ni Vercel: solo "dame una conversación y te devuelvo lo
 * que conteste Claude". Lo usan los dos sitios donde vive esto — la función de
 * Vercel en producción y el servidor de Express en local — para que no haya
 * dos versiones de la misma lógica que se separen con el tiempo.
 *
 * Los ficheros de esta carpeta que empiezan por _ no son rutas: Vercel solo
 * publica los demás.
 */
import Anthropic from '@anthropic-ai/sdk';

import { HERRAMIENTAS } from './_herramientas.js';
import { esBeta, parametrosDe } from './_modelo.js';
import { construirPrompt } from './_prompt.js';

const MAX_TOKENS = 8000;

export const MODELO = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5';

let cliente = null;
function claude() {
  // Perezoso: si se crea al importar, un despliegue sin la clave revienta al
  // arrancar en vez de devolver un error que se pueda leer.
  cliente ??= new Anthropic();
  return cliente;
}

export class ErrorDeCerebro extends Error {
  constructor(estado, mensaje, reintentable) {
    super(mensaje);
    this.estado = estado;
    this.reintentable = reintentable;
  }
}

/**
 * Un turno. Devuelve lo que conteste Claude, tal cual.
 *
 * Si trae bloques tool_use, el que llama (el navegador) los ejecuta contra la
 * agenda y vuelve a llamar con los resultados. Aquí no hay estado ninguno.
 */
export async function pensar({ mensajes, contexto }) {
  if (!Array.isArray(mensajes) || mensajes.length === 0) {
    throw new ErrorDeCerebro(400, 'Faltan los mensajes de la conversación.', false);
  }
  if (!contexto?.hoy) {
    throw new ErrorDeCerebro(400, 'Falta el contexto temporal.', false);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ErrorDeCerebro(500, 'Falta la clave de Anthropic en el servidor.', false);
  }

  const extra = parametrosDe(MODELO, MAX_TOKENS);
  const peticion = {
    model: MODELO,
    max_tokens: MAX_TOKENS,
    // Punto de cache: cubre herramientas + prompt, lo estable del turno.
    system: [
      { type: 'text', text: construirPrompt(contexto), cache_control: { type: 'ephemeral' } },
    ],
    tools: HERRAMIENTAS,
    messages: mensajes,
    ...extra,
  };

  try {
    const respuesta = esBeta(extra)
      ? await claude().beta.messages.create(peticion)
      : await claude().messages.create(peticion);

    return {
      contenido: respuesta.content,
      motivoParada: respuesta.stop_reason,
      uso: respuesta.usage,
    };
  } catch (error) {
    throw traducir(error);
  }
}

/** Distingue lo que se puede reintentar de lo que no. */
function traducir(error) {
  if (error instanceof Anthropic.AuthenticationError) {
    console.error('[cerebro] clave rechazada');
    return new ErrorDeCerebro(500, 'La clave de Anthropic no es válida.', false);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new ErrorDeCerebro(429, 'Demasiadas peticiones seguidas.', true);
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new ErrorDeCerebro(503, 'No se ha podido contactar con Anthropic.', true);
  }
  if (error instanceof Anthropic.APIStatusError) {
    console.error('[cerebro] error de la API:', error.status, error.message);
    return new ErrorDeCerebro(502, 'Anthropic ha devuelto un error.', error.status >= 500);
  }
  console.error('[cerebro] error inesperado:', error);
  return new ErrorDeCerebro(500, 'Algo ha salido mal en el servidor.', false);
}
