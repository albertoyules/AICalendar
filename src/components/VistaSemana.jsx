import { useEffect, useRef, useState } from 'react';

import { coloresDe } from '../config/categorias';
import { DIAS_CORTOS, diaDelMes, esFinDeSemana, hoy, horaDe, semanaDe } from '../lib/fechas';

const HORA_INICIO = 7;
const HORA_FIN = 23;
const ALTO_HORA = 46;
const ALTO_REJILLA = (HORA_FIN - HORA_INICIO) * ALTO_HORA;

const minutos = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Minutos desde el borde superior de la rejilla, recortado a lo visible. */
const desplazamiento = (hhmm) =>
  Math.max(0, Math.min(minutos(hhmm) - HORA_INICIO * 60, (HORA_FIN - HORA_INICIO) * 60));

export default function VistaSemana({ foco, porDia, oscuro, onAbrirEvento }) {
  const dias = semanaDe(foco);
  const claveHoy = hoy();
  const scroll = useRef(null);
  const [ahora, setAhora] = useState(() => new Date());

  // La linea de "ahora" se mueve sola. Cada minuto basta: no es un cronometro.
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Al entrar, dejamos la vista centrada en la franja util en vez de a las 7:00.
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 2 * ALTO_HORA;
  }, []);

  const horas = Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i + 1);
  const topAhora = desplazamiento(`${ahora.getHours()}:${ahora.getMinutes()}`);
  const hayHoy = dias.includes(claveHoy);

  return (
    <div
      className="flex min-h-0 grow flex-col overflow-hidden rounded-[14px]"
      style={{ background: 'var(--superficie)', border: '1px solid var(--borde)' }}
    >
      {/* cabecera de dias */}
      <div
        className="grid shrink-0"
        style={{ gridTemplateColumns: '62px repeat(7, minmax(0, 1fr))', borderBottom: '1px solid var(--borde)' }}
      >
        <div style={{ borderRight: '1px solid var(--borde)' }} />
        {dias.map((clave, i) => {
          const esHoy = clave === claveHoy;
          return (
            <div
              key={clave}
              className="py-[11px] text-center"
              style={{
                borderRight: i === 6 ? 'none' : '1px solid var(--borde)',
                background: esFinDeSemana(clave) ? 'var(--superficie-2)' : 'transparent',
              }}
            >
              <div
                className="text-[10.5px] font-semibold uppercase tracking-[0.09em]"
                style={{ color: esHoy ? 'var(--tinta-suave)' : 'var(--tinta-tenue)' }}
              >
                {DIAS_CORTOS[i]}
              </div>
              {esHoy ? (
                <div
                  className="mt-[3px] inline-flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-semibold"
                  style={{ background: 'var(--tinta)', color: 'var(--papel)' }}
                >
                  {diaDelMes(clave)}
                </div>
              ) : (
                <div className="mt-[3px] h-6 text-[13px] font-medium leading-6">{diaDelMes(clave)}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* fila de cosas sin hora */}
      <FilaSinHora dias={dias} porDia={porDia} oscuro={oscuro} onAbrirEvento={onAbrirEvento} />

      {/* rejilla horaria */}
      <div ref={scroll} className="scroll-fino min-h-0 grow overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: '62px repeat(7, minmax(0, 1fr))' }}>
          <div className="relative" style={{ height: ALTO_REJILLA, borderRight: '1px solid var(--borde)' }}>
            {horas.map((h) => (
              <div
                key={h}
                className="absolute right-2.5 numeros-tabulares text-[10.5px]"
                style={{ top: (h - HORA_INICIO) * ALTO_HORA - 6, color: 'var(--tinta-fantasma)' }}
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {dias.map((clave, i) => (
            <div
              key={clave}
              className="relative"
              style={{
                height: ALTO_REJILLA,
                borderRight: i === 6 ? 'none' : '1px solid var(--borde)',
                background: esFinDeSemana(clave) ? 'var(--superficie-2)' : 'transparent',
                backgroundImage:
                  'repeating-linear-gradient(to bottom, var(--borde-suave) 0px, var(--borde-suave) 1px, transparent 1px, transparent ' +
                  ALTO_HORA +
                  'px)',
              }}
            >
              {(porDia[clave] ?? [])
                .filter((e) => horaDe(e.inicio))
                .map((evento) => (
                  <BloqueEvento key={evento.id} evento={evento} oscuro={oscuro} onClick={onAbrirEvento} />
                ))}

              {clave === claveHoy && (
                <>
                  <div
                    className="pointer-events-none absolute left-0 right-0 h-px"
                    style={{ top: (topAhora / 60) * ALTO_HORA, background: 'var(--ahora)' }}
                  />
                  <div
                    className="pointer-events-none absolute h-[7px] w-[7px] rounded-full"
                    style={{ top: (topAhora / 60) * ALTO_HORA - 3, left: -3.5, background: 'var(--ahora)' }}
                  />
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {!hayHoy && <div className="h-0" />}
    </div>
  );
}

function FilaSinHora({ dias, porDia, oscuro, onAbrirEvento }) {
  const sinHoraPorDia = dias.map((clave) => (porDia[clave] ?? []).filter((e) => !horaDe(e.inicio)));
  if (sinHoraPorDia.every((lista) => lista.length === 0)) return null;

  return (
    <div
      className="grid shrink-0"
      style={{ gridTemplateColumns: '62px repeat(7, minmax(0, 1fr))', borderBottom: '1px solid var(--borde)' }}
    >
      <div
        className="flex items-center justify-end pr-2.5 text-[10px] uppercase tracking-[0.05em]"
        style={{ borderRight: '1px solid var(--borde)', color: 'var(--tinta-fantasma)' }}
      >
        Todo el día
      </div>
      {dias.map((clave, i) => (
        <div
          key={clave}
          className="flex min-h-[42px] flex-col gap-1 p-1.5"
          style={{
            borderRight: i === 6 ? 'none' : '1px solid var(--borde)',
            background: esFinDeSemana(clave) ? 'var(--superficie-2)' : 'transparent',
          }}
        >
          {sinHoraPorDia[i].map((evento) => {
            const c = coloresDe(evento.categoria, oscuro);
            return (
              <button
                key={evento.id}
                type="button"
                onClick={() => onAbrirEvento(evento)}
                className="w-full truncate rounded-md px-2 py-[5px] text-left text-[11.5px] font-semibold"
                style={{ background: c.fondo, color: c.texto }}
              >
                {evento.titulo}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function BloqueEvento({ evento, oscuro, onClick }) {
  const c = coloresDe(evento.categoria, oscuro);
  const inicio = horaDe(evento.inicio);
  const fin = horaDe(evento.fin ?? '');

  const arriba = (desplazamiento(inicio) / 60) * ALTO_HORA;
  const duracion = fin ? Math.max(minutos(fin) - minutos(inicio), 20) : 60;
  const alto = Math.max((duracion / 60) * ALTO_HORA, 26);

  return (
    <button
      type="button"
      onClick={() => onClick(evento)}
      className="absolute left-[5px] right-[5px] flex flex-col gap-0.5 overflow-hidden rounded-[7px] px-2 py-1.5 text-left"
      style={{ top: arriba, height: alto, background: c.fondo, color: c.texto }}
    >
      <span className="truncate text-[11.5px] font-semibold leading-tight">{evento.titulo}</span>
      {alto > 34 && (
        <span className="truncate text-[10.5px] leading-tight opacity-70">
          {fin ? `${inicio} – ${fin}` : inicio}
          {evento.lugar ? ` · ${evento.lugar}` : ''}
        </span>
      )}
    </button>
  );
}
