/**
 * Acceso a los recordatorios. Mismo patrón que habitosRepository.js: Firestore
 * con sesión, localStorage sin ella, tras la misma puerta.
 *
 * usuarios/{uid}/recordatorios — cuelga del mismo dueño, así que hereda las
 * reglas ya escritas (match /{resto=**} en firestore.rules cubre esta
 * colección sin tocar nada).
 *
 * Dos tipos, sin documento compartido:
 *   'unico'   — una vez, a una fecha y hora concretas. Al sonar se marca
 *               `hecho: true` (lo hace el servidor, en el callback de QStash)
 *               en vez de borrarse solo: el usuario decide cuándo quitarlo.
 *   'semanal' — se repite cada semana en los días marcados, hasta que se
 *               borre a mano. Un único *schedule* de QStash por recordatorio,
 *               con la lista de días en el propio cron.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';

import { firestore, hayFirebase } from '../config/firebase';
import { CATEGORIA_POR_DEFECTO } from '../config/categorias';
import { idTokenActual } from './auth';

const CLAVE_LOCAL = 'iacalendar.recordatorios';

let usuarioActual = null;

export function establecerUsuario(uid) {
  usuarioActual = uid;
}

function coleccionRecordatorios() {
  if (!usuarioActual) throw new Error('No hay sesión iniciada.');
  return collection(firestore, 'usuarios', usuarioActual, 'recordatorios');
}

function documentoRecordatorio(id) {
  return doc(firestore, 'usuarios', usuarioActual, 'recordatorios', id);
}

function enFirestore() {
  return hayFirebase && Boolean(usuarioActual);
}

/* ------------------------------------------------------------------ */
/* Normalizacion                                                       */
/* ------------------------------------------------------------------ */

export function normalizarRecordatorio(bruto) {
  const semanal = bruto.tipo === 'semanal';
  return {
    texto: String(bruto.texto ?? '').trim() || 'Recordatorio',
    tipo: semanal ? 'semanal' : 'unico',
    fecha: semanal ? null : bruto.fecha || null,
    dias: semanal ? (Array.isArray(bruto.dias) ? bruto.dias : []) : null,
    hora: bruto.hora || '09:00',
    categoria: bruto.categoria ?? CATEGORIA_POR_DEFECTO,
  };
}

/**
 * Da de alta, reprograma o retira el aviso de un recordatorio en QStash, vía
 * el servidor (el token de QStash no puede bajar al navegador). Igual que en
 * habitosRepository.js: si esto falla —sin desplegar todavía, sin las
 * variables de QStash puestas, sin red— el recordatorio se guarda igual,
 * solo que sin aviso. Nunca debe tirar abajo el guardado.
 */
async function sincronizarRecordatorio(recordatorioId, recordatorio) {
  if (!enFirestore()) return;
  try {
    const idToken = await idTokenActual();
    if (!idToken) return;
    await fetch('/api/recordatorios/programar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        recordatorioId,
        borrar: !recordatorio,
        tipo: recordatorio?.tipo ?? null,
        fecha: recordatorio?.fecha ?? null,
        dias: recordatorio?.dias ?? null,
        hora: recordatorio?.hora ?? null,
      }),
    });
  } catch (error) {
    console.warn('[IA Calendar] no se ha podido sincronizar el aviso del recordatorio:', error);
  }
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

function escribirLocal(recordatorios) {
  localStorage.setItem(CLAVE_LOCAL, JSON.stringify(recordatorios));
  oyentes.forEach((fn) => fn());
}

function idLocal() {
  return `loc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/* ------------------------------------------------------------------ */
/* API publica                                                         */
/* ------------------------------------------------------------------ */

export function suscribirRecordatorios(alCambiar, alFallar) {
  if (!enFirestore()) {
    const emitir = () => alCambiar(leerLocal());
    oyentes.add(emitir);
    emitir();
    return () => oyentes.delete(emitir);
  }

  const consulta = query(coleccionRecordatorios(), orderBy('creadoEn'));
  return onSnapshot(
    consulta,
    (snap) => alCambiar(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => {
      console.error('[IA Calendar] Firestore (recordatorios):', error);
      alFallar?.(error);
    },
  );
}

/** Lectura suelta, para la IA (consultar_recordatorios) — sin suscripción. */
export async function leerRecordatorios() {
  if (!enFirestore()) return leerLocal();
  const snap = await getDocs(coleccionRecordatorios());
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function crearRecordatorio(bruto) {
  const recordatorio = {
    ...normalizarRecordatorio(bruto),
    hecho: false,
    creadoPor: bruto.creadoPor ?? 'usuario',
    creadoEn: new Date().toISOString(),
  };

  if (!enFirestore()) {
    const id = idLocal();
    escribirLocal([...leerLocal(), { id, ...recordatorio }]);
    return id;
  }

  const ref = await addDoc(coleccionRecordatorios(), recordatorio);
  await sincronizarRecordatorio(ref.id, recordatorio);
  return ref.id;
}

export async function actualizarRecordatorio(id, cambios) {
  const normalizado = normalizarRecordatorio(cambios);

  if (!enFirestore()) {
    escribirLocal(leerLocal().map((r) => (r.id === id ? { ...r, ...normalizado } : r)));
    return;
  }
  await updateDoc(documentoRecordatorio(id), { ...normalizado, hecho: false });
  await sincronizarRecordatorio(id, normalizado);
}

export async function borrarRecordatorio(id) {
  if (!enFirestore()) {
    escribirLocal(leerLocal().filter((r) => r.id !== id));
    return;
  }
  await sincronizarRecordatorio(id, null);
  await deleteDoc(documentoRecordatorio(id));
}

/** Solo tiene sentido para 'unico': marcar o desmarcar a mano antes de que suene. */
export async function alternarHechoRecordatorio(recordatorio) {
  const hecho = !recordatorio.hecho;
  if (!enFirestore()) {
    escribirLocal(leerLocal().map((r) => (r.id === recordatorio.id ? { ...r, hecho } : r)));
    return;
  }
  await updateDoc(documentoRecordatorio(recordatorio.id), { hecho });
}
