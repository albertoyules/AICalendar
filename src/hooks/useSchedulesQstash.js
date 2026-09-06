import { useHabitos } from './useHabitos';
import { useRecordatorios } from './useRecordatorios';

/**
 * Cuenta cuántos *schedules* de QStash deberían estar activos ahora mismo,
 * para avisar antes de tropezar con el límite de 10 del plan gratuito (ver
 * "Avisos push" en CLAUDE.md). Un hábito con horaAviso y un recordatorio
 * semanal usan cada uno un *schedule* propio; los recordatorios únicos y los
 * avisos "X antes" de un evento son mensajes sueltos, no *schedules*, y no
 * cuentan para este cupo.
 *
 * Se calcula a partir de los propios documentos de Firestore, no
 * preguntando a QStash — no hay margen de funciones de Vercel (12/12) para
 * un endpoint nuevo que lo consulte en vivo. Coincide con la realidad salvo
 * que quede algún *schedule* huérfano en QStash sin su documento (p. ej. si
 * se borró el hábito con la app cerrada mientras el servidor estaba caído).
 */
export function useSchedulesQstash(listo = true) {
  const habitos = useHabitos(listo);
  const recordatorios = useRecordatorios(listo);

  const usados = habitos.filter((h) => h.horaAviso).length + recordatorios.filter((r) => r.tipo === 'semanal').length;

  return { usados, limite: 10 };
}
