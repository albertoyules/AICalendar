import { useState } from 'react';
import { Trash2, X } from 'lucide-react';

import { LISTA_CATEGORIAS, coloresDe } from '../config/categorias';
import { DIAS_CORTOS, hoy } from '../lib/fechas';

/** Alta y edición de un recordatorio: texto, tipo (único o semanal), cuándo y categoría opcional. */
export default function ModalRecordatorio({ recordatorio, oscuro, onGuardar, onBorrar, onCerrar }) {
  const editando = Boolean(recordatorio?.id);

  const [texto, setTexto] = useState(recordatorio?.texto ?? '');
  const [tipo, setTipo] = useState(recordatorio?.tipo ?? 'unico');
  const [fecha, setFecha] = useState(recordatorio?.fecha ?? hoy());
  const [dias, setDias] = useState(recordatorio?.dias ?? []);
  const [hora, setHora] = useState(recordatorio?.hora ?? '09:00');
  const [categoriaId, setCategoriaId] = useState(recordatorio?.categoria ?? null);

  const alternarDia = (indice) => {
    setDias((actual) => (actual.includes(indice) ? actual.filter((d) => d !== indice) : [...actual, indice].sort()));
  };

  const enviar = (e) => {
    e.preventDefault();
    if (!texto.trim()) return;
    if (tipo === 'semanal' && dias.length === 0) return;
    onGuardar({
      id: recordatorio?.id,
      texto: texto.trim(),
      tipo,
      fecha: tipo === 'unico' ? fecha : null,
      dias: tipo === 'semanal' ? dias : null,
      hora,
      categoria: categoriaId,
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
        className="flex w-full max-w-[400px] flex-col gap-5 rounded-[18px] p-6"
        style={{ background: 'var(--superficie)', border: '1px solid var(--borde)', boxShadow: 'var(--sombra-modal)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="m-0 text-[26px] leading-none" style={{ fontFamily: 'var(--font-serif)', fontWeight: 400 }}>
            {editando ? 'Editar recordatorio' : 'Nuevo recordatorio'}
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
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="¿Qué te recuerdo?"
          className="w-full rounded-[11px] px-4 py-3 text-[16px] outline-none"
          style={{ background: 'var(--superficie-3)', border: '1px solid var(--borde)', color: 'var(--tinta)' }}
        />

        <div className="grid grid-cols-2 gap-1.5">
          <BotonTipo activo={tipo === 'unico'} etiqueta="Una vez" onClick={() => setTipo('unico')} />
          <BotonTipo activo={tipo === 'semanal'} etiqueta="Cada semana" onClick={() => setTipo('semanal')} />
        </div>

        {tipo === 'unico' ? (
          <div className="flex gap-2.5">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="min-w-0 grow rounded-[11px] px-3.5 py-2.5 text-[15px] outline-none"
              style={{ background: 'var(--superficie-3)', border: '1px solid var(--borde)', color: 'var(--tinta)' }}
            />
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="w-[110px] shrink-0 rounded-[11px] px-3.5 py-2.5 text-[15px] outline-none"
              style={{ background: 'var(--superficie-3)', border: '1px solid var(--borde)', color: 'var(--tinta)' }}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-7 gap-1.5">
              {DIAS_CORTOS.map((etiqueta, i) => {
                const activo = dias.includes(i);
                return (
                  <button
                    key={etiqueta}
                    type="button"
                    onClick={() => alternarDia(i)}
                    className="flex h-9 items-center justify-center rounded-[9px] text-[12px] font-medium"
                    style={{
                      background: activo ? 'var(--tinta)' : 'var(--superficie-3)',
                      color: activo ? 'var(--papel)' : 'var(--tinta-suave)',
                      border: '1px solid var(--borde)',
                    }}
                  >
                    {etiqueta.slice(0, 2)}
                  </button>
                );
              })}
            </div>
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="w-full rounded-[11px] px-4 py-2.5 text-[15px] outline-none"
              style={{ background: 'var(--superficie-3)', border: '1px solid var(--borde)', color: 'var(--tinta)' }}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategoriaId(null)}
            className="flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors"
            style={{
              background: categoriaId === null ? 'var(--superficie-3)' : 'transparent',
              color: categoriaId === null ? 'var(--tinta)' : 'var(--tinta-suave)',
              border: `1px solid ${categoriaId === null ? 'var(--tinta-tenue)' : 'var(--borde)'}`,
            }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--borde)' }} />
            Sin categoría
          </button>
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

        <div className="flex items-center gap-3">
          {editando && (
            <button
              type="button"
              onClick={() => onBorrar(recordatorio.id)}
              className="flex h-11 w-11 items-center justify-center rounded-[11px]"
              style={{ border: '1px solid var(--borde)', color: 'var(--ahora)' }}
              aria-label="Borrar recordatorio"
              title="Borrar recordatorio"
            >
              <Trash2 size={17} strokeWidth={1.7} />
            </button>
          )}
          <button
            type="submit"
            className="h-11 grow rounded-[11px] text-[14.5px] font-medium"
            style={{ background: 'var(--tinta)', color: 'var(--papel)' }}
          >
            {editando ? 'Guardar cambios' : 'Añadir recordatorio'}
          </button>
        </div>
      </form>
    </div>
  );
}

function BotonTipo({ activo, etiqueta, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 items-center justify-center rounded-[10px] text-[13.5px] font-medium"
      style={{
        background: activo ? 'var(--tinta)' : 'var(--superficie-3)',
        color: activo ? 'var(--papel)' : 'var(--tinta-suave)',
        border: '1px solid var(--borde)',
      }}
    >
      {etiqueta}
    </button>
  );
}
