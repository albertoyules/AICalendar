import { useState } from 'react';
import { Trash2, X } from 'lucide-react';

import { LISTA_CATEGORIAS, coloresDe } from '../config/categorias';

/** Alta y edición de un hábito: nombre, categoría y objetivo semanal. */
export default function ModalHabito({ habito, oscuro, onGuardar, onBorrar, onCerrar }) {
  const editando = Boolean(habito?.id);

  const [nombre, setNombre] = useState(habito?.nombre ?? '');
  const [categoriaId, setCategoriaId] = useState(habito?.categoria ?? 'random');
  const [objetivoSemanal, setObjetivoSemanal] = useState(habito?.objetivoSemanal ?? 7);

  const enviar = (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    onGuardar({ id: habito?.id, nombre: nombre.trim(), categoria: categoriaId, objetivoSemanal });
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
        className="flex w-full max-w-[400px] flex-col gap-5 rounded-[18px] p-6"
        style={{ background: 'var(--superficie)', border: '1px solid var(--borde)', boxShadow: 'var(--sombra-modal)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="m-0 text-[26px] leading-none" style={{ fontFamily: 'var(--font-serif)', fontWeight: 400 }}>
            {editando ? 'Editar hábito' : 'Nuevo hábito'}
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
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="¿Qué hábito?"
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

        <div className="flex flex-col gap-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: 'var(--tinta-tenue)' }}>
            Objetivo
          </span>
          <div className="grid grid-cols-4 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setObjetivoSemanal(n)}
                className="flex h-9 items-center justify-center rounded-[9px] text-[12.5px] font-medium"
                style={{
                  background: objetivoSemanal === n ? 'var(--tinta)' : 'var(--superficie-3)',
                  color: objetivoSemanal === n ? 'var(--papel)' : 'var(--tinta-suave)',
                  border: '1px solid var(--borde)',
                }}
              >
                {n === 7 ? 'Diario' : n}
              </button>
            ))}
          </div>
          <span className="text-[12px]" style={{ color: 'var(--tinta-tenue)' }}>
            {objetivoSemanal >= 7 ? 'Todos los días' : `${objetivoSemanal} veces por semana`}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {editando && (
            <button
              type="button"
              onClick={() => onBorrar(habito.id)}
              className="flex h-11 w-11 items-center justify-center rounded-[11px]"
              style={{ border: '1px solid var(--borde)', color: 'var(--ahora)' }}
              aria-label="Borrar hábito"
              title="Borrar hábito"
            >
              <Trash2 size={17} strokeWidth={1.7} />
            </button>
          )}
          <button
            type="submit"
            className="h-11 grow rounded-[11px] text-[14.5px] font-medium"
            style={{ background: 'var(--tinta)', color: 'var(--papel)' }}
          >
            {editando ? 'Guardar cambios' : 'Añadir hábito'}
          </button>
        </div>
      </form>
    </div>
  );
}
