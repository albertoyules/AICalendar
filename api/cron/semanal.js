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
    const usuarios = await usuariosConDispositivo();

    let enviados = 0;
    for (const usuario of usuarios.docs) {
      if (usuario.data().ultimoSemanalEnviado === lunes) continue;

      const eventos = await eventosDelUsuario(usuario.ref, dias[0], dias[6]);
      const mandados = await enviarATodosLosDispositivos(usuario.ref, {
        titulo: 'Tu semana',
        cuerpo: resumenSemana(dias, agruparPorDia(eventos)),
        tipo: 'semanal',
      });
      if (mandados > 0) {
        await usuario.ref.set({ ultimoSemanalEnviado: lunes }, { merge: true });
        enviados += mandados;
      }
    }

    res.status(200).json({ ok: true, semanaDe: lunes, avisosEnviados: enviados });
  } catch (error) {
    console.error('[cron/semanal]', error);
    res.status(500).json({ error: error.message ?? 'Fallo inesperado.' });
  }
}
