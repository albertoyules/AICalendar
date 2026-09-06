import { useSchedulesQstash } from '../hooks/useSchedulesQstash';

/**
 * "7/10 avisos programados" — visible en Hábitos y Recordatorios porque
 * comparten el mismo cupo de *schedules* de QStash (ver useSchedulesQstash).
 * Antes del 06/09/2026 no había ninguna forma de ver este número: llegar al
 * límite hacía que los avisos más recientes se guardaran sin sonar, sin
 * ningún error visible en ningún sitio.
 */
export default function ContadorAvisos({ listo }) {
  const { usados, limite } = useSchedulesQstash(listo);
  const lleno = usados >= limite;
  const cerca = usados >= limite - 2;

  return (
    <span
      className="whitespace-nowrap text-[12px]"
      style={{ color: lleno ? 'var(--ahora)' : cerca ? 'var(--tinta-media)' : 'var(--tinta-tenue)' }}
      title="Hábitos con aviso + recordatorios semanales comparten un cupo de 10 en el plan gratuito de QStash."
    >
      {usados}/{limite} avisos programados
      {lleno && ' · sin hueco para más'}
    </span>
  );
}
