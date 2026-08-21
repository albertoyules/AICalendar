import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

import { LISTA_CATEGORIAS } from '../config/categorias';
import { anioDe, semanaISO, tituloMes, tituloSemana } from '../lib/fechas';

const MODOS = [
  { id: 'mes', etiqueta: 'Mes' },
  { id: 'semana', etiqueta: 'Semana' },
];

export default function CabeceraCalendario({ modo, onModo, foco, onAnterior, onSiguiente, onHoy, onNuevo }) {
  const esMes = modo === 'mes';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-6">
        <div className="flex items-baseline gap-3.5">
          <h1
            className="m-0 text-[36px] leading-none tracking-[-0.01em]"
            style={{ fontFamily: 'var(--font-serif)', fontWeight: 400 }}
          >
            {esMes ? tituloMes(foco) : tituloSemana(foco)}
          </h1>
          <span
            className="text-[21px]"
            style={{ fontFamily: 'var(--font-serif)', color: 'var(--tinta-tenue)' }}
          >
            {esMes ? anioDe(foco) : `Semana ${semanaISO(foco)}`}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-0.5">
            <BotonIcono etiqueta="Anterior" onClick={onAnterior}>
              <ChevronLeft size={16} strokeWidth={1.7} />
            </BotonIcono>
            <BotonIcono etiqueta="Siguiente" onClick={onSiguiente}>
              <ChevronRight size={16} strokeWidth={1.7} />
            </BotonIcono>
          </div>

          <button
            type="button"
            onClick={onHoy}
            className="flex h-8 items-center rounded-lg px-3.5 text-[13px] font-medium"
            style={{ border: '1px solid var(--borde)', background: 'var(--superficie)', color: 'var(--tinta)' }}
          >
            Hoy
          </button>

          <div
            className="flex items-center gap-0.5 rounded-[9px] p-[3px]"
            style={{ background: 'var(--superficie-3)' }}
          >
            {MODOS.map(({ id, etiqueta }) => {
              const activo = modo === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onModo(id)}
                  className="flex h-[26px] items-center rounded-md px-[13px] text-[13px]"
                  style={{
                    background: activo ? 'var(--superficie)' : 'transparent',
                    color: activo ? 'var(--tinta)' : 'var(--tinta-suave)',
                    fontWeight: activo ? 500 : 400,
                    boxShadow: activo ? '0 1px 2px rgba(29,26,22,0.07)' : 'none',
                  }}
                >
                  {etiqueta}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onNuevo}
            className="flex h-8 items-center gap-2 rounded-lg px-3.5 text-[13px] font-medium"
            style={{ background: 'var(--tinta)', color: 'var(--papel)' }}
          >
            <Plus size={15} strokeWidth={1.9} />
            Nuevo
          </button>
        </div>
      </div>

      <div className="flex items-center gap-5">
        {LISTA_CATEGORIAS.map((cat) => (
          <div key={cat.id} className="flex items-center gap-[7px]">
            <span className="h-2 w-2 rounded-full" style={{ background: cat.punto }} />
            <span className="text-[12.5px]" style={{ color: 'var(--tinta-suave)' }}>
              {cat.nombre}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BotonIcono({ etiqueta, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={etiqueta}
      aria-label={etiqueta}
      className="flex h-8 w-8 items-center justify-center rounded-lg"
      style={{ border: '1px solid var(--borde)', background: 'var(--superficie)', color: 'var(--tinta-suave)' }}
    >
      {children}
    </button>
  );
}
