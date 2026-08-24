import { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';

import { LISTA_CATEGORIAS, coloresDe } from '../config/categorias';
import { DIAS_CORTOS, claveDe, hoy, horaDe, indiceSemana } from '../lib/fechas';

/** ¿El evento ya tenía un fin en un día distinto al de inicio? */
function eraMultiDia(evento) {
  return Boolean(evento?.fin) && claveDe(evento.fin) > claveDe(evento.inicio);
}

/**
 * Alta y edicion de un evento a mano.
 *
 * La IA acabara creando la mayoria, pero esto tiene que existir igual: cuando
 * algo sale mal quieres poder arreglarlo tu, sin negociar con nadie.
 */
export default function ModalEvento({ evento, fechaSugerida, oscuro, onGuardar, onBorrar, onBorrarSerie, onCerrar }) {
  const editando = Boolean(evento?.id);

  const [titulo, setTitulo] = useState(evento?.titulo ?? '');
  const [categoriaId, setCategoriaId] = useState(evento?.categoria ?? 'random');
  const [fecha, setFecha] = useState(claveDe(evento?.inicio ?? fechaSugerida ?? hoy()));
  const [todoElDia, setTodoElDia] = useState(evento ? !horaDe(evento.inicio) : false);
  const [inicio, setInicio] = useState(horaDe(evento?.inicio ?? '') ?? '10:00');
  const [fin, setFin] = useState(evento && !eraMultiDia(evento) ? horaDe(evento.fin ?? '') ?? '' : '');
  // Un evento "de varios dias" (el viaje que ocupa 28-30, por ejemplo) es solo
  // esto mismo con el dia de fin distinto del de inicio — el dato ya existia
  // (`fin` acepta cualquier fecha), lo que faltaba era dejar picarlo a mano.
  const [variosDias, setVariosDias] = useState(eraMultiDia(evento));
  const [finFecha, setFinFecha] = useState(
    eraMultiDia(evento) ? claveDe(evento.fin) : claveDe(evento?.inicio ?? fechaSugerida ?? hoy()),
  );
  const [lugar, setLugar] = useState(evento?.lugar ?? '');
  const [nota, setNota] = useState(evento?.nota ?? '');
  const [recordatorioMinutosAntes, setRecordatorioMinutosAntes] = useState(evento?.recordatorioMinutosAntes ?? null);

  // La repetición solo se ofrece al crear: cambiar la de una serie ya
  // existente (mover "todos los futuros" a otro patrón) queda fuera por
  // ahora — editar una instancia sigue siendo una edición suelta normal.
  const [repetir, setRepetir] = useState('no'); // 'no' | 'diaria' | 'semanal'
  const [diasSemana, setDiasSemana] = useState(() => [indiceSemana(fecha)]);
  const [hastaSerie, setHastaSerie] = useState('');
  const [confirmandoSerie, setConfirmandoSerie] = useState(false);

  useEffect(() => {
    const alPulsar = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [onCerrar]);

  const enviar = (e) => {
    e.preventDefault();
    if (!titulo.trim()) return;
    // Dia de fin real: si "varios dias" esta apagado o el usuario dejo el
    // campo antes que el de inicio (por ejemplo al desmarcar la casilla), el
    // evento se queda de un solo dia como siempre.
    const diaFin = variosDias && finFecha >= fecha ? finFecha : fecha;
    let valorFin = null;
    if (diaFin > fecha) valorFin = todoElDia || !fin ? diaFin : `${diaFin}T${fin}`;
    else if (!todoElDia && fin) valorFin = `${fecha}T${fin}`;

    const base = {
      id: evento?.id,
      titulo,
      categoria: categoriaId,
      inicio: todoElDia ? fecha : `${fecha}T${inicio}`,
      fin: valorFin,
      todoElDia,
      lugar,
      nota,
      recordatorioMinutosAntes: todoElDia || repetir !== 'no' ? null : recordatorioMinutosAntes,
      creadoPor: evento?.creadoPor ?? 'manual',
    };
    if (!editando && repetir !== 'no') {
      onGuardar({
        ...base,
        repetir: { frecuencia: repetir, dias: repetir === 'semanal' ? diasSemana : undefined, hasta: hastaSerie || undefined },
      });
      return;
    }
    onGuardar(base);
  };

  const alternarDia = (i) => {
    setDiasSemana((actuales) =>
      actuales.includes(i) ? actuales.filter((d) => d !== i) : [...actuales, i].sort(),
    );
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
          <div className="flex gap-3">
            <Campo etiqueta={variosDias ? 'Empieza' : 'Día'}>
              <input
                type="date"
                value={fecha}
                onChange={(e) => {
                  const nueva = e.target.value;
                  setFecha(nueva);
                  // Si el fin quedaba antes del nuevo inicio, lo arrastramos
                  // con él en vez de dejar un rango invertido silencioso.
                  if (finFecha < nueva) setFinFecha(nueva);
                }}
                className="w-full bg-transparent text-[15px] outline-none"
                style={{ color: 'var(--tinta)' }}
              />
            </Campo>
            {variosDias && (
              <Campo etiqueta="Hasta">
                <input
                  type="date"
                  value={finFecha}
                  min={fecha}
                  onChange={(e) => setFinFecha(e.target.value)}
                  className="w-full bg-transparent text-[15px] outline-none"
                  style={{ color: 'var(--tinta)' }}
                />
              </Campo>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px]" style={{ color: 'var(--tinta-media)' }}>
            <input
              type="checkbox"
              checked={variosDias}
              onChange={(e) => {
                setVariosDias(e.target.checked);
                if (e.target.checked && finFecha < fecha) setFinFecha(fecha);
              }}
              className="h-4 w-4 accent-current"
            />
            Dura varios días
          </label>

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

          {!editando && (
            <div className="flex flex-col gap-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: 'var(--tinta-tenue)' }}>
                Repetir
              </span>
              <div className="flex gap-2">
                {[
                  ['no', 'No'],
                  ['diaria', 'Cada día'],
                  ['semanal', 'Cada semana'],
                ].map(([valor, etiqueta]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setRepetir(valor)}
                    className="flex-1 rounded-[10px] py-2.5 text-[13px] font-medium"
                    style={{
                      background: repetir === valor ? 'var(--tinta)' : 'var(--superficie-3)',
                      color: repetir === valor ? 'var(--papel)' : 'var(--tinta-media)',
                      border: '1px solid var(--borde)',
                    }}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>

              {repetir === 'semanal' && (
                <div className="flex gap-1.5">
                  {DIAS_CORTOS.map((dia, i) => (
                    <button
                      key={dia}
                      type="button"
                      onClick={() => alternarDia(i)}
                      className="flex h-9 flex-1 items-center justify-center rounded-[9px] text-[12px] font-medium"
                      style={{
                        background: diasSemana.includes(i) ? 'var(--tinta)' : 'var(--superficie-3)',
                        color: diasSemana.includes(i) ? 'var(--papel)' : 'var(--tinta-suave)',
                        border: '1px solid var(--borde)',
                      }}
                    >
                      {dia.slice(0, 1)}
                    </button>
                  ))}
                </div>
              )}

              {repetir !== 'no' && (
                <Campo etiqueta="Hasta (opcional)">
                  <input
                    type="date"
                    value={hastaSerie}
                    onChange={(e) => setHastaSerie(e.target.value)}
                    min={fecha}
                    className="w-full bg-transparent text-[15px] outline-none"
                    style={{ color: 'var(--tinta)' }}
                  />
                </Campo>
              )}
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
              placeholder="Opcional — se lee en el aviso si pones uno abajo"
              className="w-full bg-transparent text-[15px] outline-none"
              style={{ color: 'var(--tinta)' }}
            />
          </Campo>

          {!todoElDia && repetir === 'no' && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: 'var(--tinta-tenue)' }}>
                Avisarme antes
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  [null, 'No'],
                  [15, '15 min'],
                  [60, '1 h'],
                  [120, '2 h'],
                  [1440, '1 día'],
                ].map(([valor, etiqueta]) => (
                  <button
                    key={etiqueta}
                    type="button"
                    onClick={() => setRecordatorioMinutosAntes(valor)}
                    className="rounded-full px-3.5 py-2 text-[13px] font-medium"
                    style={{
                      background: recordatorioMinutosAntes === valor ? 'var(--tinta)' : 'var(--superficie-3)',
                      color: recordatorioMinutosAntes === valor ? 'var(--papel)' : 'var(--tinta-media)',
                      border: '1px solid var(--borde)',
                    }}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {editando && evento.serieId && (
          <div className="-mt-1 flex items-center justify-center gap-1 text-[12px]" style={{ color: 'var(--tinta-tenue)' }}>
            {confirmandoSerie ? (
              <>
                <span>¿Borrar todas las ocurrencias?</span>
                <button
                  type="button"
                  onClick={() => onBorrarSerie(evento.serieId)}
                  className="font-semibold underline"
                  style={{ color: 'var(--ahora)' }}
                >
                  Sí, todas
                </button>
                <span>·</span>
                <button type="button" onClick={() => setConfirmandoSerie(false)} className="underline">
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <span>Parte de una serie repetida.</span>
                <button
                  type="button"
                  onClick={() => setConfirmandoSerie(true)}
                  className="underline"
                  style={{ color: 'var(--tinta-media)' }}
                >
                  Borrar toda la serie
                </button>
              </>
            )}
          </div>
        )}

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
