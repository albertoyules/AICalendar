/**
 * El bucle de agente.
 *
 * Vive en el navegador a proposito. El servidor tiene la clave y piensa, pero
 * es el navegador quien puede tocar la agenda —da igual que este en Firestore
 * o en localStorage—, asi que las herramientas se ejecutan aqui:
 *
 *   1. mandamos la conversacion al servidor
 *   2. si Claude pide herramientas, las ejecutamos contra el repositorio
 *   3. le devolvemos los resultados y repetimos
 *   4. cuando contesta sin pedir nada mas, hemos terminado
 *
 * El calendario se refresca solo: tanto Firestore como el almacen local avisan
 * a sus suscriptores en cuanto algo cambia.
 */
import {
  actualizarEvento,
  borrarEvento,
  borrarSerie,
  crearSerieRecurrente,
  guardarEvento,
  leerEventos,
} from './eventosRepository';
import { hoy, lunesDe, nombreDia, semanaDe, sumarDias } from '../lib/fechas';

/** Tope de seguridad: si se pasa de aqui es que algo esta en bucle. */
const MAX_VUELTAS = 8;

class ErrorIA extends Error {
  constructor(mensaje, reintentable = false) {
    super(mensaje);
    this.reintentable = reintentable;
  }
}

/** 'lunes 2026-08-24 · martes 2026-08-25 · ...' */
function describirSemana(claveDeEsaSemana) {
  return semanaDe(claveDeEsaSemana)
    .map((c) => `${nombreDia(c)} ${c}`)
    .join(' · ');
}

/**
 * Lo que la IA necesita saber del calendario para no tener que calcular.
 *
 * Las semanas van escritas dia por dia a proposito: los modelos pequenos se
 * equivocan contando dias, y de hecho Haiku llego a decir "lunes 25" cuando el
 * 25 era martes. Dandole la tabla hecha, resolver "la semana que viene" pasa
 * de ser aritmetica a ser una consulta.
 */
function contextoTemporal() {
  const ahora = new Date();
  const claveHoy = hoy();
  const lunesEstaSemana = lunesDe(claveHoy);

  return {
    hoy: claveHoy,
    diaSemana: nombreDia(claveHoy),
    ahora: `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`,
    semanaActual: describirSemana(lunesEstaSemana),
    semanaProxima: describirSemana(sumarDias(lunesEstaSemana, 7)),
  };
}

async function pedirTurno(mensajes, contexto) {
  let respuesta;
  try {
    respuesta = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensajes, contexto }),
    });
  } catch {
    throw new ErrorIA('No encuentro el cerebro. ¿Está arrancado el servidor?', true);
  }

  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new ErrorIA(datos.error ?? 'El servidor ha fallado.', datos.reintentable ?? false);
  }
  return datos;
}

/* ------------------------------------------------------------------ */
/* Ejecucion de herramientas                                           */
/* ------------------------------------------------------------------ */

/** Lo que ve la IA de cada evento. Nada de campos que no le sirven. */
function paraLaIA(evento) {
  return {
    id: evento.id,
    titulo: evento.titulo,
    categoria: evento.categoria,
    inicio: evento.inicio,
    fin: evento.fin ?? undefined,
    lugar: evento.lugar ?? undefined,
    dia: nombreDia(evento.inicio),
    serieId: evento.serieId ?? undefined,
  };
}

const ACCIONES = {
  async consultar_agenda({ desde, hasta }) {
    const eventos = await leerEventos(desde, hasta);
    if (eventos.length === 0) return { vacio: true, mensaje: `No hay nada entre ${desde} y ${hasta}.` };
    return { eventos: eventos.map(paraLaIA) };
  },

  async crear_evento({ repetir, ...datos }) {
    if (repetir) {
      const { serieId, creados } = await crearSerieRecurrente({ ...datos, creadoPor: 'ia' }, repetir);
      return { ok: true, serieId, creados };
    }
    const id = await guardarEvento({ ...datos, creadoPor: 'ia' });
    return { ok: true, id };
  },

  async editar_evento({ id, ...cambios }) {
    if (Object.keys(cambios).length === 0) return { ok: false, motivo: 'No has mandado ningún cambio.' };
    await actualizarEvento(id, cambios);
    return { ok: true };
  },

  async borrar_evento({ id }) {
    await borrarEvento(id);
    return { ok: true };
  },

  async borrar_serie({ serieId }) {
    await borrarSerie(serieId);
    return { ok: true };
  },
};

async function ejecutar(bloque) {
  const accion = ACCIONES[bloque.name];
  if (!accion) {
    return { type: 'tool_result', tool_use_id: bloque.id, is_error: true, content: `No existe la herramienta ${bloque.name}.` };
  }
  try {
    const resultado = await accion(bloque.input);
    return { type: 'tool_result', tool_use_id: bloque.id, content: JSON.stringify(resultado) };
  } catch (error) {
    console.error(`[ia] fallo en ${bloque.name}:`, error);
    return {
      type: 'tool_result',
      tool_use_id: bloque.id,
      is_error: true,
      content: `La herramienta ha fallado: ${error.message}`,
    };
  }
}

/* ------------------------------------------------------------------ */
/* Bucle                                                               */
/* ------------------------------------------------------------------ */

export function textoDe(contenido) {
  return contenido
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

/**
 * Da un turno completo de conversacion.
 *
 * @param historial  mensajes previos en formato de la API (se devuelven ampliados)
 * @param alTrabajar callback opcional con el nombre de la herramienta en curso,
 *                   para que la interfaz pueda decir "consultando la agenda"
 */
export async function conversar(historial, alTrabajar) {
  const mensajes = [...historial];
  // Una sola foto del reloj para todo el turno: si cambiara entre llamada y
  // llamada, el prompt de sistema cambiaria y se perderia la cache.
  const contexto = contextoTemporal();

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta += 1) {
    const turno = await pedirTurno(mensajes, contexto);

    // Devolvemos el contenido tal cual, sin filtrar: los bloques de
    // razonamiento tienen que volver intactos o el modelo pierde el hilo.
    mensajes.push({ role: 'assistant', content: turno.contenido });

    if (turno.motivoParada !== 'tool_use') {
      return { mensajes, texto: textoDe(turno.contenido) };
    }

    const peticiones = turno.contenido.filter((b) => b.type === 'tool_use');
    alTrabajar?.(peticiones[0]?.name ?? null);

    // En paralelo y todos los resultados en UN solo mensaje: separarlos hace
    // que el modelo deje de pedir herramientas en paralelo.
    const resultados = await Promise.all(peticiones.map(ejecutar));
    mensajes.push({ role: 'user', content: resultados });
    alTrabajar?.(null);
  }

  throw new ErrorIA('Me he liado dando vueltas. Vuelve a intentarlo.', true);
}

export { ErrorIA };
