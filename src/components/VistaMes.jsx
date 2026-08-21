import { coloresDe } from '../config/categorias';
import {
  DIAS_CORTOS,
  diaDelMes,
  esFinDeSemana,
  hoy,
  horaDe,
  mismoMes,
  rejillaMes,
} from '../lib/fechas';

const MAX_CHIPS = 3;

/**
 * En el móvil el mes es un mapa, no una lista: caben el número y unos puntos
 * de color, y tocando un día se va a su agenda. Meter ahí las píldoras de
 * escritorio daría celdas ilegibles.
 */
export default function VistaMes({ foco, porDia, oscuro, onAbrirEvento, onNuevoEn, compacto, onDia }) {
  const dias = rejillaMes(foco);
  const claveHoy = hoy();

  return (
    <div className="flex min-h-0 grow flex-col">
      <div className="grid grid-cols-7 pb-2.5">
        {DIAS_CORTOS.map((dia) => (
          <div
            key={dia}
            className={`text-[11px] font-semibold uppercase tracking-[0.09em] ${compacto ? 'text-center' : 'pl-2.5'}`}
            style={{ color: 'var(--tinta-tenue)' }}
          >
            {compacto ? dia.slice(0, 1) : dia}
          </div>
        ))}
      </div>

      <div
        className="grid min-h-0 grow grid-cols-7 grid-rows-6 overflow-hidden rounded-[14px]"
        style={{ background: 'var(--superficie)', border: '1px solid var(--borde)' }}
      >
        {dias.map((clave, i) => {
          const delMes = mismoMes(clave, foco);
          const esHoy = clave === claveHoy;
          const eventos = porDia[clave] ?? [];
          const visibles = eventos.slice(0, MAX_CHIPS);
          const restantes = eventos.length - visibles.length;

          return (
            <div
              key={clave}
              onDoubleClick={compacto ? undefined : () => onNuevoEn(clave)}
              onClick={compacto ? () => onDia(clave) : undefined}
              className={`flex min-w-0 flex-col gap-1 pt-2.5 ${compacto ? 'items-center px-1' : 'px-2.5'}`}
              style={{
                background: delMes && !esFinDeSemana(clave) ? 'transparent' : 'var(--superficie-2)',
                borderRight: (i + 1) % 7 === 0 ? 'none' : '1px solid var(--borde-suave)',
                borderTop: i >= 7 ? '1px solid var(--borde-suave)' : 'none',
              }}
            >
              <div className="flex items-center">
                {esHoy ? (
                  <span
                    className="flex h-[21px] w-[21px] items-center justify-center rounded-full text-[12px] font-semibold"
                    style={{ background: 'var(--tinta)', color: 'var(--papel)' }}
                  >
                    {diaDelMes(clave)}
                  </span>
                ) : (
                  <span
                    className="pl-0.5 text-[12.5px]"
                    style={{ color: delMes ? 'var(--tinta-suave)' : 'var(--tinta-fantasma)' }}
                  >
                    {diaDelMes(clave)}
                  </span>
                )}
              </div>

              {compacto ? (
                <div className="flex flex-wrap gap-1 pl-0.5 pt-0.5">
                  {eventos.slice(0, 4).map((evento) => (
                    <span
                      key={evento.id}
                      className="h-[5px] w-[5px] rounded-full"
                      style={{ background: coloresDe(evento.categoria, oscuro).texto }}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex min-h-0 flex-col gap-1 overflow-hidden">
                  {visibles.map((evento) => (
                    <ChipEvento key={evento.id} evento={evento} oscuro={oscuro} onClick={onAbrirEvento} />
                  ))}
                  {restantes > 0 && (
                    <span className="pl-1.5 text-[11px]" style={{ color: 'var(--tinta-tenue)' }}>
                      +{restantes} más
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChipEvento({ evento, oscuro, onClick }) {
  const c = coloresDe(evento.categoria, oscuro);
  const hora = horaDe(evento.inicio);

  return (
    <button
      type="button"
      onClick={() => onClick(evento)}
      className="w-full truncate rounded-[5px] px-1.5 py-[3px] text-left text-[11.5px] font-medium"
      style={{ background: c.fondo, color: c.texto }}
    >
      {hora ? `${hora} ${evento.titulo}` : evento.titulo}
    </button>
  );
}
