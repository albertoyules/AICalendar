import { Play, Square, Timer } from 'lucide-react';

/**
 * Reloj pomodoro independiente de las tareas: minutos de trabajo, minutos de
 * descanso y número de rondas, configurables antes de arrancar.
 */
export default function PomodoroPanel({ pomodoro }) {
  const { config, setConfig, activo, segundosRestantes, iniciar, parar, error } = pomodoro;

  if (activo) {
    const minutos = String(Math.floor(segundosRestantes / 60)).padStart(2, '0');
    const segundos = String(segundosRestantes % 60).padStart(2, '0');
    return (
      <div
        className="flex items-center justify-between gap-3 rounded-[14px] px-4 py-3.5"
        style={{ background: 'var(--tinta)', color: 'var(--papel)' }}
      >
        <div className="flex items-center gap-3">
          <Timer size={18} strokeWidth={1.7} />
          <div className="flex flex-col leading-tight">
            <span className="text-[22px] font-semibold tabular-nums leading-none">
              {minutos}:{segundos}
            </span>
            <span className="mt-1 text-[11px] opacity-70">
              {activo.fase === 'trabajo' ? 'Trabajo' : 'Descanso'} · Ronda {activo.ronda} de {activo.rondas}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={parar}
          aria-label="Parar el pomodoro"
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: 'rgba(255,255,255,0.14)' }}
        >
          <Square size={14} strokeWidth={2} fill="currentColor" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex flex-wrap items-end gap-3 rounded-[14px] px-4 py-3.5"
        style={{ background: 'var(--superficie)', border: '1px solid var(--borde)' }}
      >
        <CampoNumero
          etiqueta="Trabajo (min)"
          valor={config.minutosTrabajo}
          onChange={(v) => setConfig((c) => ({ ...c, minutosTrabajo: v }))}
        />
        <CampoNumero
          etiqueta="Descanso (min)"
          valor={config.minutosDescanso}
          onChange={(v) => setConfig((c) => ({ ...c, minutosDescanso: v }))}
        />
        <CampoNumero
          etiqueta="Rondas"
          valor={config.rondas}
          onChange={(v) => setConfig((c) => ({ ...c, rondas: v }))}
        />
        <button
          type="button"
          onClick={iniciar}
          className="ml-auto flex h-9 items-center gap-2 rounded-[10px] px-4 text-[13px] font-medium"
          style={{ background: 'var(--tinta)', color: 'var(--papel)' }}
        >
          <Play size={14} strokeWidth={2} fill="currentColor" />
          Empezar
        </button>
      </div>
      {error && (
        <p className="m-0 px-1 text-[12px]" style={{ color: 'var(--ahora)' }}>
          {error}
        </p>
      )}
    </div>
  );
}

function CampoNumero({ etiqueta, valor, onChange }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--tinta-tenue)' }}>
        {etiqueta}
      </span>
      <input
        type="number"
        min={1}
        max={180}
        value={valor}
        onChange={(e) => onChange(Math.min(180, Math.max(1, Number(e.target.value) || 1)))}
        className="h-9 w-[68px] rounded-[9px] px-2.5 text-[14px] outline-none"
        style={{ background: 'var(--superficie-3)', border: '1px solid var(--borde)', color: 'var(--tinta)' }}
      />
    </label>
  );
}
