import { useMemo, useState } from 'react';
import { Bell, Check, Plus } from 'lucide-react';

import ModalHabito from './ModalHabito';
import { useHabitos } from '../hooks/useHabitos';
import { alternarMarca, actualizarHabito, borrarHabito, crearHabito } from '../services/habitosRepository';
import { explicarFallo } from '../services/eventosRepository';
import { coloresDe } from '../config/categorias';
import { DIAS_CORTOS, diaDelMes, hoy, indiceSemana } from '../lib/fechas';
import { calcularRacha, marcasDelMes, metaMensual, textoObjetivo, textoRacha, tiraSemana } from '../lib/habitos';

/**
 * Pantalla de hábitos: tabla (escritorio) o tarjetas apiladas (móvil, via
 * `compacto`) con los últimos 7 días, racha y progreso del mes.
 */
export default function Habitos({ oscuro, listo, compacto }) {
  const habitos = useHabitos(listo);
  const [modal, setModal] = useState(null); // null | {} (nuevo) | habito (editar)
  const [error, setError] = useState(null);

  const hoyClave = hoy();
  const dias = useMemo(() => tiraSemana(hoyClave), [hoyClave]);

  const guardar = async (datos) => {
    try {
      if (datos.id) {
        await actualizarHabito(datos.id, {
          nombre: datos.nombre,
          categoria: datos.categoria,
          objetivoSemanal: datos.objetivoSemanal,
          horaAviso: datos.horaAviso,
        });
      } else {
        await crearHabito(datos);
      }
      setError(null);
      setModal(null);
    } catch (e) {
      setError(explicarFallo(e));
    }
  };

  const borrar = async (id) => {
    try {
      await borrarHabito(id);
      setError(null);
      setModal(null);
    } catch (e) {
      setError(explicarFallo(e));
    }
  };

  const marcar = async (habito, fecha) => {
    try {
      await alternarMarca(habito, fecha);
      setError(null);
    } catch (e) {
      setError(explicarFallo(e));
    }
  };

  return (
    <div className="flex min-w-0 grow flex-col gap-4 overflow-y-auto">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[28px] leading-none" style={{ fontFamily: 'var(--font-serif)', fontWeight: 400 }}>
            Hábitos
          </h1>
          <p className="m-0 mt-1.5 text-[13px]" style={{ color: 'var(--tinta-tenue)' }}>
            Últimos siete días
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({})}
          className="flex h-9 items-center gap-2 rounded-[10px] px-3.5 text-[13px] font-medium"
          style={{ background: 'var(--superficie)', border: '1px solid var(--borde)', color: 'var(--tinta)' }}
        >
          <Plus size={15} strokeWidth={1.8} />
          Nuevo hábito
        </button>
      </div>

      {error && (
        <p className="m-0 text-[12.5px]" style={{ color: 'var(--ahora)' }}>
          {error}
        </p>
      )}

      {habitos.length === 0 ? (
        <div className="flex grow flex-col items-center justify-center gap-2 text-center">
          <p className="m-0 text-[14px]" style={{ color: 'var(--tinta-suave)' }}>
            Todavía no tienes hábitos.
          </p>
          <p className="m-0 text-[12.5px]" style={{ color: 'var(--tinta-tenue)' }}>
            El botón de arriba crea el primero.
          </p>
        </div>
      ) : (
        <div
          className="flex flex-col overflow-hidden rounded-[16px]"
          style={{ background: 'var(--superficie)', border: '1px solid var(--borde)' }}
        >
          {!compacto && <CabeceraTabla dias={dias} />}
          {habitos.map((h, i) => (
            <FilaHabito
              key={h.id}
              habito={h}
              dias={dias}
              hoyClave={hoyClave}
              oscuro={oscuro}
              compacto={compacto}
              primera={i === 0}
              onEditar={() => setModal(h)}
              onMarcar={(fecha) => marcar(h, fecha)}
            />
          ))}
        </div>
      )}

      {modal && (
        <ModalHabito
          habito={modal.id ? modal : null}
          oscuro={oscuro}
          onGuardar={guardar}
          onBorrar={borrar}
          onCerrar={() => setModal(null)}
        />
      )}
    </div>
  );
}

const COLUMNAS = '1fr 292px minmax(140px, 1fr) 90px';

function CabeceraTabla({ dias }) {
  return (
    <div
      className="grid items-end gap-6 px-5 pb-3 pt-4"
      style={{ gridTemplateColumns: COLUMNAS, borderBottom: '1px solid var(--borde-suave)', background: 'var(--superficie-2)' }}
    >
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.09em]" style={{ color: 'var(--tinta-tenue)' }}>
        Hábito
      </div>
      <div className="flex gap-[9px]">
        {dias.map((clave) => (
          <div key={clave} className="w-[34px] text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.07em]" style={{ color: 'var(--tinta-tenue)' }}>
              {DIAS_CORTOS[indiceSemana(clave)].slice(0, 2)}
            </div>
            <div className="mt-0.5 text-[11px]" style={{ color: 'var(--tinta-tenue)', fontVariantNumeric: 'tabular-nums' }}>
              {diaDelMes(clave)}
            </div>
          </div>
        ))}
      </div>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.09em]" style={{ color: 'var(--tinta-tenue)' }}>
        Progreso
      </div>
      <div className="text-right text-[10.5px] font-semibold uppercase tracking-[0.09em]" style={{ color: 'var(--tinta-tenue)' }}>
        Racha
      </div>
    </div>
  );
}

function FilaHabito({ habito, dias, hoyClave, oscuro, compacto, primera, onEditar, onMarcar }) {
  const marcas = habito.marcas ?? {};
  const c = coloresDe(habito.categoria, oscuro);
  const racha = calcularRacha(marcas, hoyClave);
  const meta = metaMensual(habito.objetivoSemanal, hoyClave);
  const hechoMes = marcasDelMes(marcas, hoyClave);
  const progresoPct = Math.min(100, Math.round((hechoMes / meta) * 100));

  const tira = (tamano) => (
    <div className="flex gap-[9px]">
      {dias.map((clave) => (
        <DiaCelda
          key={clave}
          clave={clave}
          hoyClave={hoyClave}
          hecho={Boolean(marcas[clave])}
          colores={c}
          tamano={tamano}
          onClick={() => onMarcar(clave)}
        />
      ))}
    </div>
  );

  const progreso = (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2.5">
        <span className="text-[12px]" style={{ color: 'var(--tinta-suave)' }}>
          Este mes
        </span>
        <span className="text-[12px] tabular-nums" style={{ color: 'var(--tinta-suave)' }}>
          {hechoMes} de {meta}
        </span>
      </div>
      <div className="h-[6px] overflow-hidden rounded-full" style={{ background: 'var(--superficie-3)' }}>
        <div className="h-full rounded-full" style={{ width: `${progresoPct}%`, background: c.punto }} />
      </div>
    </div>
  );

  const rachaBloque = (alinear) => (
    <div className={`flex flex-col gap-0.5 ${alinear}`}>
      <span
        className="text-[26px] leading-none"
        style={{ fontFamily: 'var(--font-serif)', color: racha > 0 ? c.texto : 'var(--tinta-tenue)' }}
      >
        {racha}
      </span>
      <span className="text-[10.5px]" style={{ color: racha > 0 ? 'var(--tinta-tenue)' : 'var(--tinta-tenue)' }}>
        {textoRacha(racha)}
      </span>
    </div>
  );

  if (compacto) {
    return (
      <div
        className="flex flex-col gap-3 p-4"
        style={primera ? undefined : { borderTop: '1px solid var(--borde-suave)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={onEditar} className="flex min-w-0 items-center gap-2.5 text-left">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.borde }} />
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold" style={{ color: 'var(--tinta)' }}>
                {habito.nombre}
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[12px]" style={{ color: 'var(--tinta-tenue)' }}>
                {textoObjetivo(habito.objetivoSemanal)}
                {habito.horaAviso && (
                  <span className="flex items-center gap-0.5">
                    <Bell size={11} strokeWidth={1.8} />
                    {habito.horaAviso}
                  </span>
                )}
              </div>
            </div>
          </button>
          {rachaBloque('items-end shrink-0')}
        </div>
        {tira(36)}
        {progreso}
      </div>
    );
  }

  return (
    <div
      className="grid items-center gap-6 px-5 py-4"
      style={{ gridTemplateColumns: COLUMNAS, borderTop: primera ? 'none' : '1px solid var(--borde-suave)' }}
    >
      <button type="button" onClick={onEditar} className="flex min-w-0 items-center gap-3 text-left">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.borde }} />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold" style={{ color: 'var(--tinta)' }}>
            {habito.nombre}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[12px]" style={{ color: 'var(--tinta-tenue)' }}>
            {textoObjetivo(habito.objetivoSemanal)}
            {habito.horaAviso && (
              <span className="flex items-center gap-0.5">
                <Bell size={11} strokeWidth={1.8} />
                {habito.horaAviso}
              </span>
            )}
          </div>
        </div>
      </button>
      {tira(34)}
      {progreso}
      {rachaBloque('items-end')}
    </div>
  );
}

function DiaCelda({ clave, hoyClave, hecho, colores, tamano, onClick }) {
  const esHoy = clave === hoyClave;
  const estilo = hecho
    ? { background: colores.fondo, color: colores.texto, border: `1px solid ${colores.borde}` }
    : esHoy
      ? { background: 'transparent', border: `1.5px dashed ${colores.borde}`, opacity: 0.7 }
      : { background: 'var(--superficie-3)', border: '1px solid transparent' };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={hecho ? 'Marcado, quitar' : 'Marcar como hecho'}
      title={hecho ? 'Marcado — clic para quitarlo' : 'Marcar como hecho'}
      className="flex shrink-0 items-center justify-center rounded-[9px]"
      style={{ width: tamano, height: tamano, ...estilo }}
    >
      {hecho && <Check size={Math.round(tamano * 0.42)} strokeWidth={2.6} />}
    </button>
  );
}
