import { useMemo } from 'react';

import { coloresDe } from '../config/categorias';
import { calcularBandas, esMultiDia } from '../lib/bandas';
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

// Alto de cada banda y separacion entre carriles apilados, en px. El hueco
// que se reserva encima de las pildoras de cada fila es carriles * ALTO_BANDA.
const ALTO_BANDA = 20;
const HUECO_BANDA = 3;
// Espacio que ya ocupan el numero del dia y su margen antes de la primera
// banda — tiene que coincidir con el pt-2.5 + alto del numero de mas abajo.
const OFFSET_SUPERIOR = 34;

/**
 * En el móvil el mes es un mapa, no una lista: caben el número y unos puntos
 * de color, y tocando un día se va a su agenda. Meter ahí las píldoras de
 * escritorio daría celdas ilegibles. Las bandas de varios días tampoco se
 * dibujan ahí por lo mismo — el punto de color ya avisa que algo pasa ese
 * día, y entrando a la agenda del día se ve el evento entero.
 */
export default function VistaMes({ foco, porDia, oscuro, onAbrirEvento, onNuevoEn, compacto, onDia }) {
  const dias = rejillaMes(foco);
  const claveHoy = hoy();

  // Los eventos de varios dias viven repetidos en porDia (uno por cada dia
  // que ocupan, ver useEventos.js) para que la agenda de dia y la semana los
  // encuentren sin esfuerzo. Aqui, en cambio, se sacan una sola vez por id:
  // se pintan como banda, no como pildora repetida en cada celda.
  const { bandas, carrilesPorFila } = useMemo(() => {
    if (compacto) return { bandas: [], carrilesPorFila: [] };
    const vistos = new Map();
    for (const clave of dias) {
      for (const evento of porDia[clave] ?? []) {
        if (esMultiDia(evento) && !vistos.has(evento.id)) vistos.set(evento.id, evento);
      }
    }
    return calcularBandas(dias, [...vistos.values()]);
  }, [dias, porDia, compacto]);

  return (
    <div className="relative flex min-h-0 grow flex-col">
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

      <div className="relative min-h-0 grow">
        <div
          className="grid h-full grid-cols-7 grid-rows-6 overflow-hidden rounded-[14px]"
          style={{ background: 'var(--superficie)', border: '1px solid var(--borde)' }}
        >
          {dias.map((clave, i) => {
            const delMes = mismoMes(clave, foco);
            const esHoy = clave === claveHoy;
            const fila = Math.floor(i / 7);
            const todos = porDia[clave] ?? [];
            const eventos = compacto ? todos : todos.filter((evento) => !esMultiDia(evento));
            const visibles = eventos.slice(0, MAX_CHIPS);
            const restantes = eventos.length - visibles.length;
            const carriles = carrilesPorFila[fila] ?? 0;

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
                  <>
                    {carriles > 0 && <div style={{ height: carriles * (ALTO_BANDA + HUECO_BANDA) }} />}
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
                  </>
                )}
              </div>
            );
          })}
        </div>

        {!compacto && bandas.length > 0 && (
          <div className="pointer-events-none absolute inset-0">
            {bandas.map((banda) => (
              <BandaEvento key={`${banda.evento.id}-${banda.fila}`} banda={banda} oscuro={oscuro} onClick={onAbrirEvento} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BandaEvento({ banda, oscuro, onClick }) {
  const { evento, fila, colInicio, colSpan, carril, puntaIzquierda, puntaDerecha } = banda;
  const c = coloresDe(evento.categoria, oscuro);

  return (
    <button
      type="button"
      onClick={() => onClick(evento)}
      className="pointer-events-auto absolute truncate text-left text-[11.5px] font-medium"
      style={{
        top: `calc(${fila} / 6 * 100% + ${OFFSET_SUPERIOR + carril * (ALTO_BANDA + HUECO_BANDA)}px)`,
        left: `calc(${colInicio} / 7 * 100% + ${puntaIzquierda ? 6 : 0}px)`,
        width: `calc(${colSpan} / 7 * 100% - ${(puntaIzquierda ? 6 : 0) + (puntaDerecha ? 6 : 0)}px)`,
        height: ALTO_BANDA,
        lineHeight: `${ALTO_BANDA}px`,
        padding: '0 6px',
        background: c.fondo,
        color: c.texto,
        borderTopLeftRadius: puntaIzquierda ? 5 : 0,
        borderBottomLeftRadius: puntaIzquierda ? 5 : 0,
        borderTopRightRadius: puntaDerecha ? 5 : 0,
        borderBottomRightRadius: puntaDerecha ? 5 : 0,
      }}
    >
      {evento.titulo}
    </button>
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
