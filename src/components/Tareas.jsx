import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Square, Timer, Trash2 } from 'lucide-react';

import { useTareas } from '../hooks/useTareas';
import { alternarHecha, borrarTarea, crearTarea } from '../services/tareasRepository';
import { hoy, sumarDias, tituloDia } from '../lib/fechas';

/**
 * Pantalla de tareas: lista del día, agrupable con un texto libre ("grupo"),
 * cada una con checkbox y un botón de pomodoro. Mismo diseño en escritorio y
 * móvil — no necesita una versión compacta aparte como Habitos.jsx.
 */
export default function Tareas({ listo, pomodoro }) {
  const [fecha, setFecha] = useState(hoy);
  const tareas = useTareas(fecha, listo);

  const [titulo, setTitulo] = useState('');
  const [grupo, setGrupo] = useState('');

  const grupos = useMemo(() => {
    const orden = [];
    const porGrupo = new Map();
    for (const t of tareas) {
      const clave = t.grupo ?? '';
      if (!porGrupo.has(clave)) {
        porGrupo.set(clave, []);
        orden.push(clave);
      }
      porGrupo.get(clave).push(t);
    }
    // Las sueltas (sin grupo) siempre primero.
    orden.sort((a, b) => (a === '' ? -1 : b === '' ? 1 : 0));
    return orden.map((clave) => [clave, porGrupo.get(clave)]);
  }, [tareas]);

  const agregar = async (e) => {
    e.preventDefault();
    if (!titulo.trim()) return;
    await crearTarea({ titulo, grupo, fecha });
    setTitulo('');
  };

  const hoyClave = hoy();

  return (
    <div className="flex min-w-0 grow flex-col gap-4 overflow-y-auto">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[28px] leading-none" style={{ fontFamily: 'var(--font-serif)', fontWeight: 400 }}>
            Tareas
          </h1>
          <p className="m-0 mt-1.5 text-[13px]" style={{ color: 'var(--tinta-tenue)' }}>
            {fecha === hoyClave ? 'Hoy' : tituloDia(fecha)}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <BotonDia etiqueta="Día anterior" onClick={() => setFecha((f) => sumarDias(f, -1))}>
            <ChevronLeft size={16} strokeWidth={1.8} />
          </BotonDia>
          {fecha !== hoyClave && (
            <button
              type="button"
              onClick={() => setFecha(hoyClave)}
              className="h-9 rounded-[10px] px-3 text-[12.5px] font-medium"
              style={{ background: 'var(--superficie)', border: '1px solid var(--borde)', color: 'var(--tinta-media)' }}
            >
              Hoy
            </button>
          )}
          <BotonDia etiqueta="Día siguiente" onClick={() => setFecha((f) => sumarDias(f, 1))}>
            <ChevronRight size={16} strokeWidth={1.8} />
          </BotonDia>
        </div>
      </div>

      <form onSubmit={agregar} className="flex gap-2">
        <input
          value={grupo}
          onChange={(e) => setGrupo(e.target.value)}
          placeholder="Grupo"
          className="h-11 w-[92px] shrink-0 rounded-[11px] px-3 text-[13.5px] outline-none sm:w-[130px]"
          style={{ background: 'var(--superficie)', border: '1px solid var(--borde)', color: 'var(--tinta)' }}
        />
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Nueva tarea"
          className="h-11 min-w-0 grow rounded-[11px] px-3.5 text-[15px] outline-none"
          style={{ background: 'var(--superficie)', border: '1px solid var(--borde)', color: 'var(--tinta)' }}
        />
        <button
          type="submit"
          aria-label="Añadir tarea"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px]"
          style={{ background: 'var(--tinta)', color: 'var(--papel)' }}
        >
          <Plus size={18} strokeWidth={1.8} />
        </button>
      </form>

      {tareas.length === 0 ? (
        <div className="flex grow flex-col items-center justify-center gap-2 text-center">
          <p className="m-0 text-[14px]" style={{ color: 'var(--tinta-suave)' }}>
            Nada apuntado para {fecha === hoyClave ? 'hoy' : 'este día'}.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {grupos.map(([nombreGrupo, lista]) => (
            <div key={nombreGrupo || '_sueltas'} className="flex flex-col gap-1.5">
              {nombreGrupo && (
                <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: 'var(--tinta-tenue)' }}>
                  {nombreGrupo}
                </span>
              )}
              <div
                className="flex flex-col overflow-hidden rounded-[14px]"
                style={{ background: 'var(--superficie)', border: '1px solid var(--borde)' }}
              >
                {lista.map((tarea, i) => (
                  <FilaTarea key={tarea.id} tarea={tarea} primera={i === 0} pomodoro={pomodoro} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilaTarea({ tarea, primera, pomodoro }) {
  const activo = pomodoro.activo?.tareaId === tarea.id;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={primera ? undefined : { borderTop: '1px solid var(--borde-suave)' }}
    >
      <button
        type="button"
        onClick={() => alternarHecha(tarea)}
        aria-label={tarea.hecha ? 'Marcar como pendiente' : 'Marcar como hecha'}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={{
          border: `1.5px solid ${tarea.hecha ? 'var(--tinta-tenue)' : 'var(--borde)'}`,
          background: tarea.hecha ? 'var(--tinta-tenue)' : 'transparent',
        }}
      >
        {tarea.hecha && <div className="h-2 w-2 rounded-full" style={{ background: 'var(--superficie)' }} />}
      </button>

      <span
        className="min-w-0 grow truncate text-[14.5px]"
        style={{
          color: tarea.hecha ? 'var(--tinta-tenue)' : 'var(--tinta)',
          textDecoration: tarea.hecha ? 'line-through' : 'none',
        }}
      >
        {tarea.titulo}
      </span>

      {!tarea.hecha && (
        <button
          type="button"
          onClick={() => (activo ? pomodoro.parar() : pomodoro.iniciar(tarea.id, tarea.titulo))}
          aria-label={activo ? 'Parar el pomodoro' : 'Empezar un pomodoro de 25 minutos'}
          title={activo ? 'Parar el pomodoro' : 'Pomodoro de 25 minutos'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]"
          style={{
            color: activo ? 'var(--papel)' : 'var(--tinta-tenue)',
            background: activo ? 'var(--tinta)' : 'transparent',
          }}
        >
          {activo ? <Square size={13} strokeWidth={2} fill="currentColor" /> : <Timer size={16} strokeWidth={1.7} />}
        </button>
      )}

      <button
        type="button"
        onClick={() => borrarTarea(tarea.id)}
        aria-label="Borrar tarea"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]"
        style={{ color: 'var(--tinta-tenue)' }}
      >
        <Trash2 size={14} strokeWidth={1.7} />
      </button>
    </div>
  );
}

function BotonDia({ etiqueta, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      className="flex h-9 w-9 items-center justify-center rounded-[10px]"
      style={{ background: 'var(--superficie)', border: '1px solid var(--borde)', color: 'var(--tinta-media)' }}
    >
      {children}
    </button>
  );
}
