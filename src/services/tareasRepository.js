/**
 * Acceso a las tareas del día. Mismo patrón que habitosRepository.js:
 * Firestore con sesión, localStorage sin ella, tras la misma puerta.
 *
 * usuarios/{uid}/tareas — cuelga del mismo dueño, hereda las reglas ya
 * escritas (match /{resto=**} en firestore.rules).
 *
 * Cada tarea pertenece a un día concreto (`fecha`, 'YYYY-MM-DD'): es una
 * lista de "hoy quiero hacer esto", no una lista maestra que se arrastra
 * sola de un día a otro. `grupo` es un texto libre opcional ("Actividades")
 * para agrupar varias tareas sueltas en la pantalla — no tiene más
 * significado que ese, es solo una etiqueta.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';

import { firestore, hayFirebase } from '../config/firebase';
import { hoy } from '../lib/fechas';

const CLAVE_LOCAL = 'iacalendar.tareas';

let usuarioActual = null;

export function establecerUsuario(uid) {
  usuarioActual = uid;
}

function coleccionTareas() {
  if (!usuarioActual) throw new Error('No hay sesión iniciada.');
  return collection(firestore, 'usuarios', usuarioActual, 'tareas');
}

function documentoTarea(id) {
  return doc(firestore, 'usuarios', usuarioActual, 'tareas', id);
}

function enFirestore() {
  return hayFirebase && Boolean(usuarioActual);
}

/* ------------------------------------------------------------------ */
/* Normalizacion                                                       */
/* ------------------------------------------------------------------ */

export function normalizarTarea(bruto) {
  return {
    titulo: String(bruto.titulo ?? '').trim() || 'Sin título',
    grupo: bruto.grupo?.trim() || null,
    fecha: bruto.fecha ?? hoy(),
    hecha: Boolean(bruto.hecha),
  };
}

/* ------------------------------------------------------------------ */
/* Almacen local                                                       */
/* ------------------------------------------------------------------ */

const oyentes = new Set();

function leerLocal() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_LOCAL) ?? '[]');
  } catch {
    return [];
  }
}

function escribirLocal(tareas) {
  localStorage.setItem(CLAVE_LOCAL, JSON.stringify(tareas));
  oyentes.forEach((fn) => fn());
}

function idLocal() {
  return `loc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/* ------------------------------------------------------------------ */
/* API publica                                                         */
/* ------------------------------------------------------------------ */

/** Las tareas de un día concreto, escuchando en vivo. */
export function suscribirTareas(fecha, alCambiar, alFallar) {
  if (!enFirestore()) {
    const emitir = () => alCambiar(leerLocal().filter((t) => t.fecha === fecha));
    oyentes.add(emitir);
    emitir();
    return () => oyentes.delete(emitir);
  }

  const consulta = query(coleccionTareas(), where('fecha', '==', fecha), orderBy('creadoEn'));
  return onSnapshot(
    consulta,
    (snap) => alCambiar(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => {
      console.error('[IA Calendar] Firestore (tareas):', error);
      alFallar?.(error);
    },
  );
}

export async function crearTarea(bruto) {
  const tarea = { ...normalizarTarea(bruto), creadoEn: new Date().toISOString() };

  if (!enFirestore()) {
    const id = idLocal();
    escribirLocal([...leerLocal(), { id, ...tarea }]);
    return id;
  }

  const ref = await addDoc(coleccionTareas(), tarea);
  return ref.id;
}

export async function actualizarTarea(id, cambios) {
  if (!enFirestore()) {
    escribirLocal(leerLocal().map((t) => (t.id === id ? { ...t, ...cambios } : t)));
    return;
  }
  await updateDoc(documentoTarea(id), cambios);
}

export async function alternarHecha(tarea) {
  await actualizarTarea(tarea.id, { hecha: !tarea.hecha });
}

export async function borrarTarea(id) {
  if (!enFirestore()) {
    escribirLocal(leerLocal().filter((t) => t.id !== id));
    return;
  }
  await deleteDoc(documentoTarea(id));
}
