/**
 * El aviso de las 9: qué tienes hoy.
 *
 * Vercel Hobby solo permite un disparo al día y no garantiza el minuto
 * exacto (puede llegar en cualquier momento de la hora configurada) — ver
 * "Avisos push" en el README para el porqué y las alternativas.
 */
import { agruparPorDia, resumenDia } from '../../src/lib/resumen.js';
import { enviarATodosLosDispositivos } from '../_avisos.js';
import { autorizado, eventosDelUsuario, hoyMadrid, usuariosConDispositivo } from './_comun.js';

export default async function handler(req, res) {
  if (!autorizado(req)) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const hoy = hoyMadrid();
    const usuarios = await usuariosConDispositivo();

    let enviados = 0;
    const fallos = [];
    for (const usuario of usuarios.docs) {
      // Vercel puede repetir una invocación: sin esto, un usuario recibiría el
      // mismo aviso dos veces el mismo día.
      if (usuario.data().ultimoDiarioEnviado === hoy) continue;

      const eventos = await eventosDelUsuario(usuario.ref, hoy, hoy);
      const { enviados: mandados, fallos: fallosUsuario } = await enviarATodosLosDispositivos(usuario.ref, {
        titulo: 'Tu día',
        cuerpo: resumenDia(eventos),
        tipo: 'diario',
      });
      fallos.push(...fallosUsuario);
      if (mandados > 0) {
        await usuario.ref.set({ ultimoDiarioEnviado: hoy }, { merge: true });
        enviados += mandados;
      }
    }

    res.status(200).json({ ok: true, fecha: hoy, avisosEnviados: enviados, fallos });
  } catch (error) {
    console.error('[cron/diario]', error);
    res.status(500).json({ error: error.message ?? 'Fallo inesperado.' });
  }
}
