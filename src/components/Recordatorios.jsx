import { useMemo, useState } from 'react';
import { Plus, Repeat, Trash2 } from 'lucide-react';

import ModalRecordatorio from './ModalRecordatorio';
import { useRecordatorios } from '../hooks/useRecordatorios';
import { actualizarRecordatorio, borrarRecordatorio, crearRecordatorio } from '../services/recordatoriosRepository';
import { explicarFallo } from '../services/eventosRepository';
import { coloresDe } from '../config/categorias';
import { DIAS_CORTOS, cuantoFalta } from '../lib/fechas';

/**
 * Pantalla de recordatorios: avisos sueltos que no son eventos del
 * calendario. Puntuales (una vez, se marcan hechos al sonar pero no se
 * borran solos) y semanales (se repiten hasta que se borran a mano).
 */
export default function Recordatorios({ oscuro, listo }) {
  const recordatorios = useRecordatorios(listo);
  const [modal, setModal] = useState(null); // null | {} (nuevo) | recordatorio (editar)
  const [error, setError] = useState(null);

  const { puntuales, semanales } = useMemo(() => {
    const puntualesArr = recordatorios.filter((r) => r.tipo === 'unico');
    const semanalesArr = recordatorios.filter((r) => r.tipo === 'semanal');

    puntualesArr.sort((a, b) => {
      if (Boolean(a.hecho) !== Boolean(b.hecho)) return a.hecho ? 1 : -1;
      return `${a.fecha}T${a.hora}`.localeCompare(`${b.fecha}T${b.hora}`);
    });
    semanalesArr.sort((a, b) => a.hora.localeCompare(b.hora));

    return { puntuales: puntualesArr, semanales: semanalesArr };
  }, [recordatorios]);

  const guardar = async (datos) => {
    try {
      if (datos.id) await actualizarRecordatorio(datos.id, datos);
      else await crearRecordatorio(datos);
      setError(null);
      setModal(null);
    } catch (e) {
      setError(explicarFallo(e));
    }
  };

  const borrar = async (id) => {
    try {
      await borrarRecordatorio(id);
      setError(null);
      setModal(null);
    } catch (e) {
      setError(explicarFallo(e));
    }
  };

  return (
    <div className="flex min-w-0 grow flex-col gap-4 overflow-y-auto">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[28px] leading-none" style={{ fontFamily: 'var(--font-serif)', fontWeight: 400 }}>
            Recordatorios
          </h1>
          <p className="m-0 mt-1.5 text-[13px]" style={{ color: 'var(--tinta-tenue)' }}>
            Avisos sueltos, dentro y fuera del calendario
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({})}
          className="flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-[10px] px-3.5 text-[13px] font-medium"
          style={{ background: 'var(--superficie)', border: '1px solid var(--borde)', color: 'var(--tinta)' }}
        >
          <Plus size={15} strokeWidth={1.8} />
          Nuevo
        </button>
      </div>

      {error && (
        <p className="m-0 text-[12.5px]" style={{ color: 'var(--ahora)' }}>
          {error}
        </p>
      )}

      {recordatorios.length === 0 ? (
        <div className="flex grow flex-col items-center justify-center gap-2 text-center">
          <p className="m-0 text-[14px]" style={{ color: 'var(--tinta-suave)' }}>
            Todavía no tienes recordatorios.
          </p>
          <p className="m-0 text-[12.5px]" style={{ color: 'var(--tinta-tenue)' }}>
            El botón de arriba crea el primero, o pídeselo al asistente.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {puntuales.length > 0 && (
            <Grupo titulo="Puntuales">
              {puntuales.map((r, i) => (
                <Fila key={r.id} recordatorio={r} primera={i === 0} oscuro={oscuro} onEditar={() => setModal(r)} onBorrar={() => borrar(r.id)} />
              ))}
            </Grupo>
          )}
          {semanales.length > 0 && (
            <Grupo titulo="Cada semana">
              {semanales.map((r, i) => (
                <Fila key={r.id} recordatorio={r} primera={i === 0} oscuro={oscuro} onEditar={() => setModal(r)} onBorrar={() => borrar(r.id)} />
              ))}
            </Grupo>
          )}
        </div>
      )}

      {modal && (
        <ModalRecordatorio
          recordatorio={modal.id ? modal : null}
          oscuro={oscuro}
          onGuardar={guardar}
          onBorrar={borrar}
          onCerrar={() => setModal(null)}
        />
      )}
    </div>
  );
}

function Grupo({ titulo, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: 'var(--tinta-tenue)' }}>
        {titulo}
      </span>
      <div className="flex flex-col overflow-hidden rounded-[14px]" style={{ background: 'var(--superficie)', border: '1px solid var(--borde)' }}>
        {children}
      </div>
    </div>
  );
}

function textoCuando(recordatorio) {
  if (recordatorio.tipo === 'semanal') {
    const nombres = [...(recordatorio.dias ?? [])].sort((a, b) => a - b).map((d) => DIAS_CORTOS[d]);
    return `${nombres.join(', ')} · ${recordatorio.hora}`;
  }
  const falta = cuantoFalta(recordatorio.fecha);
  return `${falta.charAt(0).toUpperCase()}${falta.slice(1)} · ${recordatorio.hora}`;
}

function Fila({ recordatorio, primera, oscuro, onEditar, onBorrar }) {
  const c = recordatorio.categoria ? coloresDe(recordatorio.categoria, oscuro) : null;
  const hecho = recordatorio.tipo === 'unico' && recordatorio.hecho;

  return (
    <div className="flex items-center gap-3 px-4 py-3" style={primera ? undefined : { borderTop: '1px solid var(--borde-suave)' }}>
      {c && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.borde }} />}

      <button type="button" onClick={onEditar} className="flex min-w-0 grow flex-col items-start text-left">
        <span
          className="min-w-0 max-w-full truncate text-[14.5px]"
          style={{ color: hecho ? 'var(--tinta-tenue)' : 'var(--tinta)', textDecoration: hecho ? 'line-through' : 'none' }}
        >
          {recordatorio.texto}
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-[12px]" style={{ color: 'var(--tinta-tenue)' }}>
          {recordatorio.tipo === 'semanal' && <Repeat size={10} strokeWidth={1.8} />}
          {textoCuando(recordatorio)}
        </span>
      </button>

      <button
        type="button"
        onClick={onBorrar}
        aria-label="Borrar recordatorio"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]"
        style={{ color: 'var(--tinta-tenue)' }}
      >
        <Trash2 size={14} strokeWidth={1.7} />
      </button>
    </div>
  );
}
