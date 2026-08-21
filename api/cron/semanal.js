/**
 * El briefing de los lunes: la semana entera de un vistazo.
 */
import { agruparPorDia, resumenSemana } from '../../src/lib/resumen.js';
import { sumarDias } from '../../src/lib/fechas.js';
import { enviarATodosLosDispositivos } from '../_avisos.js';
import { autorizado, eventosDelUsuario, hoyMadrid, usuariosConDispositivo } from './_comun.js';

export default async function handler(req, res) {
  if (!autorizado(req)) return res.status(401).json({ error: 'No autorizado.' });

  const lunes = hoyMadrid();
  // Se programa para lunes, pero por si acaso Vercel lo dispara otro día
  // (retraso, reintento), no manda un "briefing semanal" fuera de lunes.
  const diaSemana = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', weekday: 'short' }).format(new Date());
  if (diaSemana !== 'Mon') return res.status(200).json({ ok: true, omitido: 'no es lunes en Madrid' });

  try {
    const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
    const refsUsuarios = await usuariosConDispositivo();

    let enviados = 0;
    const fallos = [];
    for (const refUsuario of refsUsuarios) {
      const snap = await refUsuario.get();
      if (snap.exists && snap.data().ultimoSemanalEnviado === lunes) continue;

      const eventos = await eventosDelUsuario(refUsuario, dias[0], dias[6]);
      const { enviados: mandados, fallos: fallosUsuario } = await enviarATodosLosDispositivos(refUsuario, {
        titulo: 'Tu semana',
        cuerpo: resumenSemana(dias, agruparPorDia(eventos)),
        tipo: 'semanal',
      });
      fallos.push(...fallosUsuario);
      if (mandados > 0) {
        await refUsuario.set({ ultimoSemanalEnviado: lunes }, { merge: true });
        enviados += mandados;
      }
    }

    res.status(200).json({ ok: true, semanaDe: lunes, avisosEnviados: enviados, fallos });
  } catch (error) {
    console.error('[cron/semanal]', error);
    res.status(500).json({ error: error.message ?? 'Fallo inesperado.' });
  }
}
