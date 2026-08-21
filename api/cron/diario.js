/**
 * El aviso de las 9: qué tienes hoy.
 *
 * Vercel Hobby solo permite un disparo al día y no garantiza el minuto
 * exacto (puede llegar en cualquier momento de la hora configurada) — ver
 * "Avisos push" en el README para el porqué y las alternativas.
 */
import { resumenDia } from '../../src/lib/resumen.js';
import { enviarATodosLosDispositivos } from '../_avisos.js';
import { autorizado, eventosDelUsuario, hoyMadrid, usuariosConDispositivo } from './_comun.js';

export default async function handler(req, res) {
  if (!autorizado(req)) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const hoy = hoyMadrid();
    const refsUsuarios = await usuariosConDispositivo();

    let enviados = 0;
    const fallos = [];
    for (const refUsuario of refsUsuarios) {
      const snap = await refUsuario.get();
      // Vercel puede repetir una invocación: sin esto, un usuario recibiría el
      // mismo aviso dos veces el mismo día. snap.exists es false la primera
      // vez que se avisa a alguien — este set() es lo que crea el documento
      // de verdad, no solo la sombra que dejan las subcolecciones.
      if (snap.exists && snap.data().ultimoDiarioEnviado === hoy) continue;

      const eventos = await eventosDelUsuario(refUsuario, hoy, hoy);
      const { enviados: mandados, fallos: fallosUsuario } = await enviarATodosLosDispositivos(refUsuario, {
        titulo: 'Tu día',
        cuerpo: resumenDia(eventos),
        tipo: 'diario',
      });
      fallos.push(...fallosUsuario);
      if (mandados > 0) {
        await refUsuario.set({ ultimoDiarioEnviado: hoy }, { merge: true });
        enviados += mandados;
      }
    }

    res.status(200).json({ ok: true, fecha: hoy, avisosEnviados: enviados, fallos });
  } catch (error) {
    console.error('[cron/diario]', error);
    res.status(500).json({ error: error.message ?? 'Fallo inesperado.' });
  }
}
