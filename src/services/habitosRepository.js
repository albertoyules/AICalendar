/**
 * Acceso a los hábitos. Mismo patrón que eventosRepository.js: Firestore con
 * sesión, localStorage sin ella, tras la misma puerta.
 *
 * usuarios/{uid}/habitos — cuelga del mismo dueño, así que hereda las reglas
 * ya escritas (match /{resto=**} en firestore.rules cubre esta colección sin
 * tocar nada).
 */
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';

import { firestore, hayFirebase } from '../config/firebase';
import { CATEGORIA_POR_DEFECTO } from '../config/categorias';
import { idTokenActual } from './auth';

const CLAVE_LOCAL = 'iacalendar.habitos';

let usuarioActual = null;

export function establecerUsuario(uid) {
  usuarioActual = uid;
}

function coleccionHabitos() {
  if (!usuarioActual) throw new Error('No hay sesión iniciada.');
  return collection(firestore, 'usuarios', usuarioActual, 'habitos');
}

function documentoHabito(id) {
  return doc(firestore, 'usuarios', usuarioActual, 'habitos', id);
}

function enFirestore() {
  return hayFirebase && Boolean(usuarioActual);
}

/* ------------------------------------------------------------------ */
/* Normalizacion                                                       */
/* ------------------------------------------------------------------ */

export function normalizarHabito(bruto) {
  return {
    nombre: String(bruto.nombre ?? '').trim() || 'Sin nombre',
    categoria: bruto.categoria ?? CATEGORIA_POR_DEFECTO,
    objetivoSemanal: Math.min(7, Math.max(1, Number(bruto.objetivoSemanal) || 7)),
    horaAviso: bruto.horaAviso || null,
  };
}

/**
 * Da de alta o retira el aviso de un hábito en QStash, vía el servidor (el
 * token de QStash no puede bajar al navegador). Es un extra sobre el hábito
 * en sí: si esto falla — sin desplegar todavía, sin las variables de QStash
 * puestas, sin red — el hábito se guarda igual, solo que sin aviso. Nunca
 * debe tirar abajo el guardado del hábito por esto.
 */
async function sincronizarRecordatorio(habitoId, horaAviso) {
  if (!enFirestore()) return;
  try {
    const idToken = await idTokenActual();
    if (!idToken) return;
    await fetch('/api/habitos/recordatorio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, habitoId, horaAviso }),
    });
  } catch (error) {
    console.warn('[IA Calendar] no se ha podido sincronizar el aviso del hábito:', error);
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

function escribirLocal(habitos) {
  localStorage.setItem(CLAVE_LOCAL, JSON.stringify(habitos));
  oyentes.forEach((fn) => fn());
}

function idLocal() {
  return `loc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/* ------------------------------------------------------------------ */
/* API publica                                                         */
/* ------------------------------------------------------------------ */

export function suscribirHabitos(alCambiar, alFallar) {
  if (!enFirestore()) {
    const emitir = () => alCambiar(leerLocal());
    oyentes.add(emitir);
    emitir();
    return () => oyentes.delete(emitir);
  }

  const consulta = query(coleccionHabitos(), orderBy('creadoEn'));
  return onSnapshot(
    consulta,
    (snap) => alCambiar(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => {
      console.error('[IA Calendar] Firestore (hábitos):', error);
      alFallar?.(error);
    },
  );
}

export async function crearHabito(bruto) {
  const habito = { ...normalizarHabito(bruto), marcas: {}, creadoEn: new Date().toISOString() };

  if (!enFirestore()) {
    const id = idLocal();
    escribirLocal([...leerLocal(), { id, ...habito }]);
    return id;
  }

  const ref = await addDoc(coleccionHabitos(), habito);
  await sincronizarRecordatorio(ref.id, habito.horaAviso);
  return ref.id;
}

export async function actualizarHabito(id, cambios) {
  if (!enFirestore()) {
    escribirLocal(leerLocal().map((h) => (h.id === id ? { ...h, ...cambios } : h)));
    return;
  }
  await updateDoc(documentoHabito(id), cambios);
  if ('horaAviso' in cambios) await sincronizarRecordatorio(id, cambios.horaAviso);
}

export async function borrarHabito(id) {
  if (!enFirestore()) {
    escribirLocal(leerLocal().filter((h) => h.id !== id));
    return;
  }
  await deleteDoc(documentoHabito(id));
  await sincronizarRecordatorio(id, null);
}

/**
 * Marca o desmarca un día concreto. Se manda como campo con notación de
 * punto (`marcas.2026-08-22`) para no pisar el resto de marcas del hábito
 * con una escritura a medias si dos pestañas tocan el mismo hábito a la vez.
 */
export async function alternarMarca(habito, fecha) {
  const hecho = !habito.marcas?.[fecha];
  const marcas = { ...habito.marcas, [fecha]: hecho };
  if (!hecho) delete marcas[fecha];

  if (!enFirestore()) {
    escribirLocal(leerLocal().map((h) => (h.id === habito.id ? { ...h, marcas } : h)));
    return;
  }
  await updateDoc(documentoHabito(habito.id), { [`marcas.${fecha}`]: hecho ? true : deleteField() });
}
