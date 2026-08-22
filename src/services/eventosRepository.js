/**
 * Acceso a los eventos. Dos implementaciones detras de la misma puerta:
 *
 *   Firestore    cuando hay credenciales, con onSnapshot -> el calendario se
 *                actualiza solo cuando la IA crea algo desde otro sitio.
 *   localStorage cuando no las hay, para poder probar la app sin montar nada.
 *
 * Las fechas se guardan como texto 'YYYY-MM-DDTHH:mm'. Al ser ordenables
 * alfabeticamente, los rangos funcionan igual en Firestore que en memoria.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { firestore, hayFirebase } from '../config/firebase';
import { CATEGORIA_POR_DEFECTO } from '../config/categorias';
import { sinMarcas } from '../components/Markdown';
import { claveDe, diffDias, horaDe, hoy, sumarDias } from '../lib/fechas';
import { fechasDeSerie } from '../lib/recurrencia';
import { idTokenActual } from './auth';

const CLAVE_LOCAL = 'iacalendar.eventos';
const CLAVE_MIGRADO = 'iacalendar.migrado';

/**
 * Cada agenda cuelga de su dueño: usuarios/{uid}/eventos.
 *
 * Frente a una colección plana con un campo `uid`, esto sale ganando por dos
 * lados: las reglas de seguridad son una línea, y las consultas por fecha no
 * necesitan índice compuesto porque ya van dentro de la colección del usuario.
 */
let usuarioActual = null;

export function establecerUsuario(uid) {
  usuarioActual = uid;
}

function coleccionEventos() {
  if (!usuarioActual) throw new Error('No hay sesión iniciada.');
  return collection(firestore, 'usuarios', usuarioActual, 'eventos');
}

function documentoEvento(id) {
  return doc(firestore, 'usuarios', usuarioActual, 'eventos', id);
}

/** Con Firebase configurado pero sin sesión todavía, no hay nada que leer. */
function enFirestore() {
  return hayFirebase && Boolean(usuarioActual);
}

/* ------------------------------------------------------------------ */
/* Normalizacion                                                       */
/* ------------------------------------------------------------------ */

/**
 * Deja un evento en la forma canonica. Se aplica tanto a lo que escribe el
 * usuario como a lo que devuelva la IA, que es de donde vendran las sorpresas.
 */
export function normalizarEvento(bruto) {
  const inicio = String(bruto.inicio ?? hoy());
  const todoElDia = bruto.todoElDia ?? !inicio.includes('T');
  return {
    titulo: sinMarcas(bruto.titulo ?? '').trim() || 'Sin título',
    categoria: bruto.categoria ?? CATEGORIA_POR_DEFECTO,
    inicio,
    fin: bruto.fin ?? null,
    todoElDia,
    lugar: bruto.lugar?.trim() || null,
    nota: bruto.nota?.trim() || null,
    recordatorioMinutosAntes: Number(bruto.recordatorioMinutosAntes) || null,
    creadoPor: bruto.creadoPor ?? 'manual',
  };
}

/**
 * Da de alta, reprograma o retira el aviso "X antes" de un evento en QStash,
 * vía el servidor (igual que sincronizarRecordatorio() en
 * habitosRepository.js — el token de QStash no puede bajar al navegador).
 * Best-effort: si falla (sin desplegar, sin red, sin las variables de
 * QStash), el evento se guarda igual, solo que sin aviso.
 */
async function sincronizarRecordatorioEvento(eventoId, inicio, recordatorioMinutosAntes) {
  if (!enFirestore()) return;
  try {
    const idToken = await idTokenActual();
    if (!idToken) return;
    await fetch('/api/eventos/recordatorio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, eventoId, inicio, recordatorioMinutosAntes }),
    });
  } catch (error) {
    console.warn('[IA Calendar] no se ha podido sincronizar el aviso del evento:', error);
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

function escribirLocal(eventos) {
  localStorage.setItem(CLAVE_LOCAL, JSON.stringify(eventos));
  oyentes.forEach((fn) => fn());
}

function idLocal() {
  return `loc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/* ------------------------------------------------------------------ */
/* API publica                                                         */
/* ------------------------------------------------------------------ */

/**
 * Escucha los eventos de un rango. Devuelve la funcion para dejar de escuchar.
 * `desde` y `hasta` son claves 'YYYY-MM-DD', ambas inclusive.
 */
export function suscribirEventos(desde, hasta, alCambiar, alFallar) {
  const tope = `${hasta}T99:99`; // cubre el dia entero, con hora o sin ella

  if (!enFirestore()) {
    const emitir = () => {
      const filtrados = leerLocal()
        .filter((e) => e.inicio >= desde && e.inicio <= tope)
        .sort((a, b) => a.inicio.localeCompare(b.inicio));
      alCambiar(filtrados);
    };
    oyentes.add(emitir);
    emitir();
    return () => oyentes.delete(emitir);
  }

  const consulta = query(
    coleccionEventos(),
    where('inicio', '>=', desde),
    where('inicio', '<=', tope),
    orderBy('inicio'),
  );

  return onSnapshot(
    consulta,
    (snap) => alCambiar(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => {
      console.error('[IA Calendar] Firestore:', error);
      alFallar?.(error);
    },
  );
}

/**
 * Lectura de una sola vez del mismo rango. La usa la IA cuando llama a
 * consultar_agenda: ahi no queremos una suscripcion viva, solo la foto.
 */
export async function leerEventos(desde, hasta) {
  const tope = `${hasta}T99:99`;

  if (!enFirestore()) {
    return leerLocal()
      .filter((e) => e.inicio >= desde && e.inicio <= tope)
      .sort((a, b) => a.inicio.localeCompare(b.inicio));
  }

  const snap = await getDocs(
    query(
      coleccionEventos(),
      where('inicio', '>=', desde),
      where('inicio', '<=', tope),
      orderBy('inicio'),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function guardarEvento(bruto) {
  const evento = { ...normalizarEvento(bruto), creadoEn: new Date().toISOString() };

  if (!enFirestore()) {
    const id = idLocal();
    escribirLocal([...leerLocal(), { id, ...evento }]);
    return id;
  }

  const ref = await addDoc(coleccionEventos(), evento);
  if (evento.recordatorioMinutosAntes) {
    await sincronizarRecordatorioEvento(ref.id, evento.inicio, evento.recordatorioMinutosAntes);
  }
  return ref.id;
}

export async function actualizarEvento(id, cambiosBrutos) {
  // La IA manda 0 para "quita el aviso" (su esquema no admite null) — se deja
  // en null antes de guardar, que es como vive "sin aviso" en el resto del código.
  const cambios =
    'recordatorioMinutosAntes' in cambiosBrutos
      ? { ...cambiosBrutos, recordatorioMinutosAntes: cambiosBrutos.recordatorioMinutosAntes || null }
      : cambiosBrutos;

  if (!enFirestore()) {
    escribirLocal(leerLocal().map((e) => (e.id === id ? { ...e, ...cambios } : e)));
    return;
  }
  await updateDoc(documentoEvento(id), cambios);

  // Si cambia la hora o el propio aviso, hay que reprogramarlo — se relee el
  // documento ya fusionado porque `cambios` puede traer solo uno de los dos.
  if ('inicio' in cambios || 'recordatorioMinutosAntes' in cambios) {
    const snap = await getDoc(documentoEvento(id));
    const actual = snap.data();
    await sincronizarRecordatorioEvento(id, actual.inicio, actual.recordatorioMinutosAntes);
  }
}

export async function borrarEvento(id) {
  if (!enFirestore()) {
    escribirLocal(leerLocal().filter((e) => e.id !== id));
    return;
  }
  await sincronizarRecordatorioEvento(id, null, null);
  await deleteDoc(documentoEvento(id));
}

/* ------------------------------------------------------------------ */
/* Series repetidas                                                     */
/* ------------------------------------------------------------------ */

/**
 * Crea una serie: un evento que se repite, como N eventos normales que
 * comparten `serieId`. No hay un documento "plantilla" aparte — cada
 * ocurrencia es un evento de verdad, editable y borrable una a una con las
 * funciones de siempre. `serieId` es solo la etiqueta que las agrupa para
 * poder borrarlas todas de una vez con `borrarSerie`.
 */
export async function crearSerieRecurrente(bruto, repetir) {
  const serieId = idLocal();
  const claveInicio = claveDe(bruto.inicio);
  const hora = horaDe(bruto.inicio);
  const desplazamientoFin = bruto.fin ? diffDias(claveInicio, claveDe(bruto.fin)) : null;
  const horaFin = bruto.fin ? horaDe(bruto.fin) : null;

  const fechas = fechasDeSerie({ ...repetir, inicio: claveInicio });

  const instancias = fechas.map((clave) => ({
    ...normalizarEvento({
      ...bruto,
      inicio: hora ? `${clave}T${hora}` : clave,
      fin: desplazamientoFin === null ? null : `${sumarDias(clave, desplazamientoFin)}T${horaFin}`,
    }),
    serieId,
    creadoEn: new Date().toISOString(),
  }));

  if (!enFirestore()) {
    escribirLocal([...leerLocal(), ...instancias.map((e) => ({ id: idLocal(), ...e }))]);
    return { serieId, creados: instancias.length };
  }

  // 180 ocurrencias como mucho (tope de fechasDeSerie): muy por debajo del
  // límite de 500 operaciones de un writeBatch, no hace falta trocearlo.
  const lote = writeBatch(firestore);
  for (const instancia of instancias) lote.set(doc(coleccionEventos()), instancia);
  await lote.commit();
  return { serieId, creados: instancias.length };
}

/** Borra todas las ocurrencias de una serie, en el almacén que toque. */
export async function borrarSerie(serieId) {
  if (!enFirestore()) {
    const restantes = leerLocal().filter((e) => e.serieId !== serieId);
    escribirLocal(restantes);
    return;
  }

  const snap = await getDocs(query(coleccionEventos(), where('serieId', '==', serieId)));
  const lote = writeBatch(firestore);
  snap.docs.forEach((d) => lote.delete(d.ref));
  await lote.commit();
}

/* ------------------------------------------------------------------ */
/* Datos de muestra                                                    */
/* ------------------------------------------------------------------ */

/**
 * Solo en modo local y solo la primera vez: siembra unos eventos alrededor de
 * hoy para que el calendario no aparezca vacio al arrancar. Con Firebase
 * conectado esto no se ejecuta nunca.
 */
export function sembrarSiHaceFalta() {
  if (hayFirebase || localStorage.getItem(CLAVE_LOCAL)) return;

  const d = (n) => sumarDias(hoy(), n);
  const muestra = [
    { titulo: 'Bases de Datos', categoria: 'universidad', inicio: `${d(0)}T09:00`, fin: `${d(0)}T11:00`, lugar: 'Aula 3.2' },
    { titulo: 'Gimnasio', categoria: 'salud', inicio: `${d(0)}T18:30` },
    { titulo: 'Tratamiento', categoria: 'salud', inicio: `${d(1)}T10:00`, fin: `${d(1)}T11:00` },
    { titulo: 'Turno', categoria: 'trabajo', inicio: `${d(1)}T16:00`, fin: `${d(1)}T22:00` },
    { titulo: 'Recoger paquete en Correos', categoria: 'random', inicio: `${d(2)}T17:30` },
    { titulo: 'Entrega Práctica 1', categoria: 'universidad', inicio: `${d(3)}T23:59` },
    { titulo: 'Turno', categoria: 'trabajo', inicio: `${d(4)}T16:00`, fin: `${d(4)}T22:00` },
    { titulo: 'Cumple de Marta', categoria: 'random', inicio: `${d(5)}T21:00` },
    { titulo: 'Parcial de Estadística', categoria: 'universidad', inicio: `${d(8)}T09:00`, fin: `${d(8)}T11:00` },
  ];

  escribirLocal(
    muestra.map((e) => ({
      id: idLocal(),
      ...normalizarEvento(e),
      creadoEn: new Date().toISOString(),
      // Marcados para que al entrar con cuenta no acaben en tu agenda real.
      deMuestra: true,
    })),
  );
}

/* ------------------------------------------------------------------ */
/* Migracion                                                           */
/* ------------------------------------------------------------------ */

/**
 * Sube a Firestore lo que quedara guardado en el navegador.
 *
 * Se ejecuta una sola vez por dispositivo, la primera vez que entras con
 * sesion. No borra el almacen local: si algo saliera mal, los datos siguen
 * ahi. Solo deja una marca de que ya se hizo.
 */
export async function migrarDesdeLocal() {
  if (!enFirestore()) return { migrados: 0 };
  if (localStorage.getItem(CLAVE_MIGRADO)) return { migrados: 0 };

  // Lo sembrado para que la app no arrancara vacia no es tuyo: se queda fuera.
  const locales = leerLocal().filter((e) => !e.deMuestra);
  if (locales.length === 0) {
    localStorage.setItem(CLAVE_MIGRADO, new Date().toISOString());
    return { migrados: 0 };
  }

  try {
    const lote = writeBatch(firestore);
    for (const { id, ...evento } of locales) {
      lote.set(doc(coleccionEventos()), { ...evento, migradoDe: id });
    }
    await lote.commit();
    localStorage.setItem(CLAVE_MIGRADO, new Date().toISOString());
    console.info(`[IA Calendar] ${locales.length} eventos subidos a tu cuenta.`);
    return { migrados: locales.length };
  } catch (error) {
    // Sin marca: se reintentara en la proxima entrada.
    console.error('[IA Calendar] no se ha podido migrar:', error);
    return { migrados: 0, error };
  }
}

/**
 * Traduce un error de Firestore a algo que se pueda leer y arreglar.
 *
 * El caso importante es `permission-denied`: pasa cuando las reglas siguen
 * siendo las de fabrica de "modo produccion", que bloquean a todo el mundo
 * incluido tu. Sin este aviso la app simplemente no guarda nada y no dice por
 * que, que es la peor forma posible de fallar.
 */
export function explicarFallo(error) {
  if (error?.code === 'permission-denied') {
    return 'Firestore está rechazando el acceso. Publica el contenido de firestore.rules en la consola de Firebase, en Firestore Database > Reglas.';
  }
  if (error?.code === 'unavailable') {
    return 'Sin conexión con Firestore. Lo que hagas ahora puede no guardarse.';
  }
  if (error?.code === 'failed-precondition') {
    return 'A Firestore le falta un índice para esta consulta. El mensaje de la consola del navegador trae el enlace para crearlo.';
  }
  return 'No se ha podido guardar. Mira la consola del navegador para el detalle.';
}
