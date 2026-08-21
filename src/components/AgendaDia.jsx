import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

import { coloresDe } from '../config/categorias';
import {
  cuantoFalta,
  diaDelMes,
  hoy,
  horaDe,
  nombreMes,
  semanaISO,
  sumarDias,
  tituloDia,
} from '../lib/fechas';

/**
 * La pantalla principal en el móvil: el día, no el mes.
 *
 * En una pantalla de teléfono un mes entero son celdas de 50px donde no cabe
 * nada legible. Lo que de verdad necesitas mirar en el móvil es qué te queda
 * hoy, y eso cabe de sobra.
 */
export default function AgendaDia({ foco, onFoco, porDia, proximos, oscuro, onAbrirEvento, onNuevo }) {
  const eventos = porDia[foco] ?? [];
  const esHoy = foco === hoy();
  const ahora = new Date();
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();

  return (
    <div className="flex min-h-0 grow flex-col overflow-hidden">
      {/* cabecera */}
      <div className="flex items-start justify-between gap-4 px-5 pb-4">
        <div className="min-w-0">
          <div
            className="truncate text-[32px] leading-[1.1] tracking-[-0.01em]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {tituloDia(foco)}
          </div>
          <div className="mt-1 text-[13px]" style={{ color: 'var(--tinta-tenue)' }}>
            {nombreMes(foco)} · semana {semanaISO(foco)}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <BotonDia etiqueta="Día anterior" onClick={() => onFoco(sumarDias(foco, -1))}>
            <ChevronLeft size={18} strokeWidth={1.7} />
          </BotonDia>
          {!esHoy && (
            <button
              type="button"
              onClick={() => onFoco(hoy())}
              className="h-11 rounded-xl px-3 text-[13px] font-medium"
              style={{ border: '1px solid var(--borde)', color: 'var(--tinta)' }}
            >
              Hoy
            </button>
          )}
          <BotonDia etiqueta="Día siguiente" onClick={() => onFoco(sumarDias(foco, 1))}>
            <ChevronRight size={18} strokeWidth={1.7} />
          </BotonDia>
        </div>
      </div>

      <div className="scroll-fino flex min-h-0 grow flex-col gap-6 overflow-y-auto px-5 pb-6">
        {eventos.length === 0 ? (
          <div
            className="flex flex-col items-center gap-3 rounded-[16px] px-6 py-10 text-center"
            style={{ background: 'var(--superficie)', border: '1px solid var(--borde)' }}
          >
            <span className="text-[14.5px]" style={{ color: 'var(--tinta-suave)' }}>
              Nada apuntado este día.
            </span>
            <button
              type="button"
              onClick={() => onNuevo(foco)}
              className="flex h-11 items-center gap-2 rounded-xl px-4 text-[14px] font-medium"
              style={{ background: 'var(--tinta)', color: 'var(--papel)' }}
            >
              <Plus size={16} strokeWidth={2} />
              Añadir algo
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            {eventos.map((evento, i) => {
              const hora = horaDe(evento.inicio);
              const pasado =
                esHoy && hora && Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3)) < minutosAhora;
              const c = coloresDe(evento.categoria, oscuro);

              return (
                <button
                  key={evento.id}
                  type="button"
                  onClick={() => onAbrirEvento(evento)}
                  className="flex w-full items-stretch gap-3.5 text-left"
                  style={{ opacity: pasado ? 0.45 : 1 }}
                >
                  <div className="w-[46px] shrink-0 pt-4 text-right">
                    <span
                      className="numeros-tabulares text-[12.5px]"
                      style={{ color: 'var(--tinta-suave)' }}
                    >
                      {hora ?? '—'}
                    </span>
                  </div>

                  <div className="flex grow items-stretch gap-3.5">
                    <div className="flex w-[3px] shrink-0 flex-col items-center">
                      <span
                        className="w-[3px] grow rounded-full"
                        style={{ background: i === 0 ? 'transparent' : 'var(--borde)' }}
                      />
                    </div>
                    <div
                      className="grow py-3"
                      style={{ borderBottom: i === eventos.length - 1 ? 'none' : '1px solid var(--borde-suave)' }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.texto }} />
                        <span className="truncate text-[15.5px] font-medium">{evento.titulo}</span>
                      </div>
                      {(evento.lugar || horaDe(evento.fin ?? '')) && (
                        <div className="mt-1 pl-4 text-[12.5px]" style={{ color: 'var(--tinta-suave)' }}>
                          {[horaDe(evento.fin ?? '') && `hasta las ${horaDe(evento.fin)}`, evento.lugar]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {proximos.length > 0 && (
          <div className="flex flex-col gap-2">
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.09em]"
              style={{ color: 'var(--tinta-tenue)' }}
            >
              Vence pronto
            </span>
            {proximos.map((evento) => {
              const c = coloresDe(evento.categoria, oscuro);
              return (
                <button
                  key={evento.id}
                  type="button"
                  onClick={() => onAbrirEvento(evento)}
                  className="flex items-center justify-between gap-3 rounded-[14px] px-4 py-3.5 text-left"
                  style={{ background: c.fondo, border: `1px solid ${c.borde}` }}
                >
                  <span className="truncate text-[14px] font-semibold" style={{ color: c.texto }}>
                    {evento.titulo}
                  </span>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
                    style={{ background: 'var(--superficie)', color: c.texto }}
                  >
                    {cuantoFalta(evento.inicio)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function BotonDia({ etiqueta, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      className="flex h-11 w-11 items-center justify-center rounded-xl"
      style={{ border: '1px solid var(--borde)', color: 'var(--tinta-suave)' }}
    >
      {children}
    </button>
  );
}
