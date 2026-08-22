/**
 * Recoge los "avísame X antes" de eventos que se quedaron sin programar
 * porque estaban demasiado lejos para el plan gratuito de QStash (más de
 * 6,5 días vista) y ya han entrado dentro de la ventana.
 *
 * api/eventos/recordatorio.js programa el aviso al momento cuando puede; si
 * no puede, deja el evento con recordatorioMinutosAntes puesto pero sin
 * recordatorioIdQstash. Este cron, una vez al día, revisa los próximos días
 * y programa de verdad los que ya caben dentro del plazo — el mismo evento
 * puede tardar varios días en "entrar" si se creó con mucha antelación, y
 * eso está bien: se recoge solo, sin que nadie tenga que volver a tocarlo.
 */
import { sumarDias } from '../../src/lib/fechas.js';
import { MAX_ADELANTO_SEGUNDOS, qstash, urlBase } from '../_qstash.js';
import { autorizado, hoyMadrid, instanteMadrid, usuariosConDispositivo } from './_comun.js';

export default async function handler(req, res) {
  if (!autorizado(req)) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const hoy = hoyMadrid();
    const hasta = sumarDias(hoy, 8); // margen de sobra por encima del tope de 6,5 días
    const refsUsuarios = await usuariosConDispositivo();

    let programados = 0;
    const fallos = [];

    for (const refUsuario of refsUsuarios) {
      const snap = await refUsuario
        .collection('eventos')
        .where('inicio', '>=', hoy)
        .where('inicio', '<=', `${hasta}T99:99`)
        .get();

      for (const doc of snap.docs) {
        const evento = doc.data();
        if (!evento.recordatorioMinutosAntes || evento.recordatorioIdQstash) continue;
        if (!evento.inicio?.includes('T')) continue; // sin hora no hay "X antes" que valga

        const objetivoMs = instanteMadrid(evento.inicio) - evento.recordatorioMinutosAntes * 60_000;
        const faltanSegundos = Math.floor((objetivoMs - Date.now()) / 1000);
        // Negativo: ya pasó, no se manda tarde. Por encima del tope: todavía
        // no le toca, se revisa otro día.
        if (faltanSegundos <= 0 || faltanSegundos > MAX_ADELANTO_SEGUNDOS) continue;

        try {
          const destino = `${urlBase()}/api/qstash/recordatorioEvento?uid=${encodeURIComponent(refUsuario.id)}&eventoId=${encodeURIComponent(doc.id)}`;
          const { messageId } = await qstash().publish({ url: destino, notBefore: Math.floor(objetivoMs / 1000) });
          await doc.ref.set({ recordatorioIdQstash: messageId, recordatorioEnviado: false }, { merge: true });
          programados += 1;
        } catch (error) {
          console.error('[cron/encolarRecordatorios]', doc.id, error);
          fallos.push({ eventoId: doc.id, error: error.message });
        }
      }
    }

    res.status(200).json({ ok: true, fecha: hoy, programados, fallos });
  } catch (error) {
    console.error('[cron/encolarRecordatorios]', error);
    res.status(500).json({ error: error.message ?? 'Fallo inesperado.' });
  }
}
