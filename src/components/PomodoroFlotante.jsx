import { Square, Timer } from 'lucide-react';

/** Cuenta atrás visible desde cualquier pantalla mientras corre un pomodoro. */
export default function PomodoroFlotante({ pomodoro, movil }) {
  const { activo, segundosRestantes, parar } = pomodoro;
  if (!activo) return null;

  const minutos = String(Math.floor(segundosRestantes / 60)).padStart(2, '0');
  const segundos = String(segundosRestantes % 60).padStart(2, '0');
  const enDescanso = activo.fase === 'descanso';

  return (
    <div
      className="fixed z-30 flex items-center gap-3 rounded-full py-2 pl-4 pr-2 shadow-lg"
      style={
        movil
          ? { left: '50%', bottom: 92, transform: 'translateX(-50%)', background: 'var(--tinta)', color: 'var(--papel)' }
          : { left: 88, bottom: 24, background: 'var(--tinta)', color: 'var(--papel)' }
      }
    >
      <Timer size={16} strokeWidth={1.8} />
      <div className="flex flex-col leading-tight">
        <span className="text-[13px] font-semibold tabular-nums">
          {minutos}:{segundos}
        </span>
        <span className="max-w-[140px] truncate text-[10.5px] opacity-70">
          {enDescanso ? 'Descanso' : activo.titulo}
        </span>
      </div>
      <button
        type="button"
        onClick={parar}
        aria-label="Parar el pomodoro"
        title="Parar"
        className="flex h-7 w-7 items-center justify-center rounded-full"
        style={{ background: 'rgba(255,255,255,0.14)' }}
      >
        <Square size={12} strokeWidth={2} fill="currentColor" />
      </button>
    </div>
  );
}
