import { useCallback, useEffect, useState } from 'react';

/**
 * Un pomodoro por vez, para toda la app — vive en App.jsx, no en la pantalla
 * de Tareas, para que si cambias a Calendario un momento no se pare solo.
 *
 * Todo en memoria, nada en Firestore: una sesión de 25 minutos no merece la
 * complejidad de sincronizarla entre dispositivos, y si recargas la página
 * a media sesión, empezar de nuevo es lo razonable.
 *
 * Se guarda el instante en que acaba (`finEn`), no un contador que reste
 * segundo a segundo: así una pestaña en segundo plano (donde los navegadores
 * frenan los timers) no se desincroniza, el tiempo real siempre manda.
 */
const MINUTOS_TRABAJO = 25;
const MINUTOS_DESCANSO = 5;

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

function avisar(fase) {
  pitido();
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    const titulo = fase === 'trabajo' ? 'Pomodoro terminado' : 'Descanso terminado';
    const cuerpo = fase === 'trabajo' ? 'Toca descansar 5 minutos.' : 'A por el siguiente bloque.';
    new Notification(titulo, { body: cuerpo });
  }
}

export function usePomodoro() {
  const [activo, setActivo] = useState(null); // { tareaId, titulo, fase, finEn } | null
  const [ahora, setAhora] = useState(Date.now());

  useEffect(() => {
    if (!activo) return undefined;
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activo]);

  useEffect(() => {
    if (!activo || ahora < activo.finEn) return;
    avisar(activo.fase);
    const siguienteFase = activo.fase === 'trabajo' ? 'descanso' : 'trabajo';
    const minutos = siguienteFase === 'trabajo' ? MINUTOS_TRABAJO : MINUTOS_DESCANSO;
    setActivo((actual) =>
      actual ? { ...actual, fase: siguienteFase, finEn: Date.now() + minutos * 60_000 } : actual,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ahora]);

  const iniciar = useCallback((tareaId, titulo) => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    setAhora(Date.now());
    setActivo({ tareaId, titulo, fase: 'trabajo', finEn: Date.now() + MINUTOS_TRABAJO * 60_000 });
  }, []);

  const parar = useCallback(() => setActivo(null), []);

  const segundosRestantes = activo ? Math.max(0, Math.round((activo.finEn - ahora) / 1000)) : 0;

  return { activo, segundosRestantes, iniciar, parar };
}
