import { Activity, CalendarDays, List, Mic } from 'lucide-react';

/**
 * La barra de abajo del móvil. Tres cosas y el micro en el centro, grande:
 * es la acción principal de toda la app y tiene que caer donde llega el pulgar.
 * Todos los blancos son de 56px o más, por encima del mínimo táctil de 44.
 */
export default function BarraMovil({ pantalla, onPantalla, onChat }) {
  return (
    <div
      className="seguro-abajo flex shrink-0 items-center justify-between gap-4 px-6 pt-3"
      style={{ background: 'var(--superficie)', borderTop: '1px solid var(--borde)' }}
    >
      <Lateral
        activo={pantalla === 'mes'}
        etiqueta={pantalla === 'mes' ? 'Día' : 'Mes'}
        icono={pantalla === 'mes' ? List : CalendarDays}
        onClick={() => onPantalla(pantalla === 'mes' ? 'agenda' : 'mes')}
      />

      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={onChat}
          aria-label="Abrir el asistente"
          className="flex h-[68px] w-[68px] items-center justify-center rounded-full active:scale-95"
          style={{
            background: 'var(--tinta)',
            color: 'var(--papel)',
            boxShadow: '0 6px 20px rgba(29,26,22,0.22)',
            transition: 'transform 120ms ease',
          }}
        >
          <Mic size={27} strokeWidth={1.5} />
        </button>
        <span className="text-[10.5px]" style={{ color: 'var(--tinta-tenue)' }}>
          Habla
        </span>
      </div>

      <Lateral
        activo={pantalla === 'habitos'}
        etiqueta="Hábitos"
        icono={Activity}
        onClick={() => onPantalla('habitos')}
      />
    </div>
  );
}

function Lateral({ activo, etiqueta, icono: Icono, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[56px] w-[56px] flex-col items-center justify-center gap-1 rounded-2xl"
      style={{
        border: '1px solid var(--borde)',
        background: activo ? 'var(--superficie-3)' : 'transparent',
        color: activo ? 'var(--tinta)' : 'var(--tinta-suave)',
      }}
    >
      <Icono size={20} strokeWidth={1.6} />
      <span className="text-[9.5px] font-medium">{etiqueta}</span>
    </button>
  );
}
