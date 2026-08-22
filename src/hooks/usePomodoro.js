import { useCallback, useEffect, useState } from 'react';

/**
 * Un reloj pomodoro para toda la app — vive en App.jsx, no en Tareas, para
 * que cambiar de pantalla no lo pare y para que algún día pueda arrancarse
 * desde cualquier sitio, no solo desde una tarea concreta.
 *
 * Todo en memoria, nada en Firestore: una sesión de trabajo no merece la
 * complejidad de sincronizarla entre dispositivos, y si recargas la página a
 * media sesión, empezar de nuevo es lo razonable.
 *
 * Se guarda el instante en que acaba la fase (`finEn`), no un contador que
 * reste segundo a segundo: así una pestaña en segundo plano (donde los
 * navegadores frenan los timers) no se desincroniza, el reloj real manda.
 */
const CONFIG_POR_DEFECTO = { minutosTrabajo: 25, minutosDescanso: 5, rondas: 4 };

function pitido() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const ganancia = ctx.createGain();
    osc.connect(ganancia);
    ganancia.connect(ctx.destination);
    osc.frequency.value = 880;
    ganancia.gain.setValueAtTime(0.15, ctx.currentTime);
    ganancia.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // Sin Web Audio (Safari antiguo, algún navegador raro): sin sonido, pero
    // el aviso en pantalla sigue funcionando igual.
  }
}

function avisar(titulo, cuerpo) {
  pitido();
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(titulo, { body: cuerpo });
  }
}

export function usePomodoro() {
  const [config, setConfig] = useState(CONFIG_POR_DEFECTO);
  const [activo, setActivo] = useState(null); // { fase, ronda, finEn } | null
  const [ahora, setAhora] = useState(Date.now());

  useEffect(() => {
    if (!activo) return undefined;
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activo]);

  useEffect(() => {
    if (!activo || ahora < activo.finEn) return;

    if (activo.fase === 'trabajo') {
      if (activo.ronda >= config.rondas) {
        avisar('Pomodoro completo', `${config.rondas} rondas hechas. Buen trabajo.`);
        setActivo(null);
        return;
      }
      avisar('Descanso', `Toca descansar ${config.minutosDescanso} min.`);
      setActivo((a) => a && { fase: 'descanso', ronda: a.ronda, finEn: Date.now() + config.minutosDescanso * 60_000 });
    } else {
      avisar('A trabajar', `Ronda ${activo.ronda + 1} de ${config.rondas}.`);
      setActivo((a) => a && { fase: 'trabajo', ronda: a.ronda + 1, finEn: Date.now() + config.minutosTrabajo * 60_000 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ahora]);

  const iniciar = useCallback(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    setAhora(Date.now());
    setActivo({ fase: 'trabajo', ronda: 1, finEn: Date.now() + config.minutosTrabajo * 60_000 });
  }, [config]);

  const parar = useCallback(() => setActivo(null), []);

  const segundosRestantes = activo
    ? Math.max(0, Math.round((activo.finEn - ahora) / 1000))
    : config.minutosTrabajo * 60;

  return { config, setConfig, activo, segundosRestantes, iniciar, parar };
}
