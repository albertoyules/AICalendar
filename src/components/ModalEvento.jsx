import { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';

import { LISTA_CATEGORIAS, coloresDe } from '../config/categorias';
import { claveDe, hoy, horaDe } from '../lib/fechas';

/**
 * Alta y edicion de un evento a mano.
 *
 * La IA acabara creando la mayoria, pero esto tiene que existir igual: cuando
 * algo sale mal quieres poder arreglarlo tu, sin negociar con nadie.
 */
export default function ModalEvento({ evento, fechaSugerida, oscuro, onGuardar, onBorrar, onCerrar }) {
  const editando = Boolean(evento?.id);

  const [titulo, setTitulo] = useState(evento?.titulo ?? '');
  const [categoriaId, setCategoriaId] = useState(evento?.categoria ?? 'random');
  const [fecha, setFecha] = useState(claveDe(evento?.inicio ?? fechaSugerida ?? hoy()));
  const [todoElDia, setTodoElDia] = useState(evento ? !horaDe(evento.inicio) : false);
  const [inicio, setInicio] = useState(horaDe(evento?.inicio ?? '') ?? '10:00');
  const [fin, setFin] = useState(horaDe(evento?.fin ?? '') ?? '');
  const [lugar, setLugar] = useState(evento?.lugar ?? '');
  const [nota, setNota] = useState(evento?.nota ?? '');

  useEffect(() => {
    const alPulsar = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [onCerrar]);

  const enviar = (e) => {
    e.preventDefault();
    if (!titulo.trim()) return;
    onGuardar({
      id: evento?.id,
      titulo,
      categoria: categoriaId,
      inicio: todoElDia ? fecha : `${fecha}T${inicio}`,
      fin: todoElDia || !fin ? null : `${fecha}T${fin}`,
      todoElDia,
      lugar,
      nota,
      creadoPor: evento?.creadoPor ?? 'manual',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(29,26,22,0.35)' }}
      onClick={onCerrar}
    >
      <form
        onSubmit={enviar}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[440px] flex-col gap-5 rounded-[18px] p-6"
        style={{ background: 'var(--superficie)', border: '1px solid var(--borde)', boxShadow: 'var(--sombra-modal)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <h2
            className="m-0 text-[26px] leading-none"
            style={{ fontFamily: 'var(--font-serif)', fontWeight: 400 }}
          >
            {editando ? 'Editar' : 'Nuevo evento'}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ color: 'var(--tinta-suave)' }}
          >
            <X size={18} strokeWidth={1.7} />
          </button>
        </div>

        <input
          autoFocus
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="¿Qué es?"
          className="w-full rounded-[11px] px-4 py-3 text-[16px] outline-none"
          style={{ background: 'var(--superficie-3)', border: '1px solid var(--borde)', color: 'var(--tinta)' }}
        />

        <div className="flex flex-wrap gap-2">
          {LISTA_CATEGORIAS.map((cat) => {
            const activa = cat.id === categoriaId;
            const c = coloresDe(cat.id, oscuro);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoriaId(cat.id)}
                className="flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors"
                style={{
                  background: activa ? c.fondo : 'transparent',
                  color: activa ? c.texto : 'var(--tinta-suave)',
                  border: `1px solid ${activa ? c.borde : 'var(--borde)'}`,
                }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: cat.punto }} />
                {cat.nombre}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3">
          <Campo etiqueta="Día">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full bg-transparent text-[15px] outline-none"
              style={{ color: 'var(--tinta)' }}
            />
          </Campo>

          <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px]" style={{ color: 'var(--tinta-media)' }}>
            <input
              type="checkbox"
              checked={todoElDia}
              onChange={(e) => setTodoElDia(e.target.checked)}
              className="h-4 w-4 accent-current"
            />
            Sin hora concreta
          </label>

          {!todoElDia && (
            <div className="flex gap-3">
              <Campo etiqueta="Empieza">
                <input
                  type="time"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                  className="w-full bg-transparent text-[15px] outline-none"
                  style={{ color: 'var(--tinta)' }}
                />
              </Campo>
              <Campo etiqueta="Acaba">
                <input
                  type="time"
                  value={fin}
                  onChange={(e) => setFin(e.target.value)}
                  className="w-full bg-transparent text-[15px] outline-none"
                  style={{ color: 'var(--tinta)' }}
                />
              </Campo>
            </div>
          )}

          <Campo etiqueta="Dónde">
            <input
              value={lugar}
              onChange={(e) => setLugar(e.target.value)}
              placeholder="Opcional"
              className="w-full bg-transparent text-[15px] outline-none"
              style={{ color: 'var(--tinta)' }}
            />
          </Campo>

          <Campo etiqueta="Nota">
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Opcional"
              className="w-full bg-transparent text-[15px] outline-none"
              style={{ color: 'var(--tinta)' }}
            />
          </Campo>
        </div>

        <div className="flex items-center gap-3">
          {editando && (
            <button
              type="button"
              onClick={() => onBorrar(evento.id)}
              className="flex h-11 w-11 items-center justify-center rounded-[11px]"
              style={{ border: '1px solid var(--borde)', color: 'var(--ahora)' }}
              aria-label="Borrar evento"
              title="Borrar evento"
            >
              <Trash2 size={17} strokeWidth={1.7} />
            </button>
          )}
          <button
            type="submit"
            className="h-11 grow rounded-[11px] text-[14.5px] font-medium"
            style={{ background: 'var(--tinta)', color: 'var(--papel)' }}
          >
            {editando ? 'Guardar cambios' : 'Añadir al calendario'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Campo({ etiqueta, children }) {
  return (
    <label
      className="flex grow flex-col gap-1 rounded-[11px] px-4 py-2.5"
      style={{ background: 'var(--superficie-3)', border: '1px solid var(--borde)' }}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: 'var(--tinta-tenue)' }}>
        {etiqueta}
      </span>
      {children}
    </label>
  );
}
