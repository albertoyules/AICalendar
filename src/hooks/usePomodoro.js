import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import { firestore, hayFirebase } from '../config/firebase';
import { idTokenActual } from '../services/auth';
import { pitido } from '../lib/sonido';

/**
 * El pomodoro. Con Firebase configurado, el reloj vive en el servidor
 * (usePomodoroRemoto): Firestore guarda la fase actual y QStash manda un
 * mensaje por cada cambio, así que sigue avisando con la app cerrada o el
 * móvil bloqueado — antes era un timer del navegador nada más, y por eso no
 * llegaba nada si no tenías la pestaña abierta.
 *
 * Entre fases, el reloj no sigue solo: al acabar el trabajo o el descanso,
 * avisa y se queda "esperando" hasta que alguien pulsa "Seguir" — así el
 * descanso no arranca de golpe si sigues a medias de algo.
 *
 * Sin Firebase (modo local, para trastear sin montar nada) no hay servidor
 * al que llamar: usePomodoroLocal hace lo mismo, un timer en memoria que
 * solo cuenta mientras la pestaña está abierta.
 *
 * `hayFirebase` es una constante fija al cargar la app (nunca cambia en
 * caliente), así que elegir aquí qué hook usar no rompe las reglas de los
 * hooks — es, en la práctica, una decisión de una sola vez por sesión.
 */
export function usePomodoro(usuario) {
  return hayFirebase ? usePomodoroRemoto(usuario) : usePomodoroLocal();
}

const CONFIG_POR_DEFECTO = { minutosTrabajo: 25, minutosDescanso: 5, rondas: 4 };

function usePomodoroRemoto(usuario) {
  const [estado, setEstado] = useState(null);
  const [configBorrador, setConfigBorrador] = useState(CONFIG_POR_DEFECTO);
  const [ahora, setAhora] = useState(Date.now());
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!usuario) return undefined;
    return onSnapshot(
      doc(firestore, 'usuarios', usuario.uid, 'pomodoro', 'actual'),
      (snap) => setEstado(snap.exists() ? snap.data() : null),
      (err) => console.error('[IA Calendar] Firestore (pomodoro):', err),
    );
  }, [usuario]);

  const activo = estado?.activo ? estado : null;

  useEffect(() => {
    if (!activo || activo.esperando) return undefined;
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activo]);

  const llamar = useCallback(async (ruta, cuerpo) => {
    try {
      const idToken = await idTokenActual();
      if (!idToken) return;
      const respuesta = await fetch(ruta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, ...cuerpo }),
      });
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => ({}));
        setError(datos.error ?? 'No se ha podido hablar con el servidor.');
      } else {
        setError(null);
      }
    } catch {
      setError('Sin conexión con el servidor.');
    }
  }, []);

  const iniciar = useCallback(() => llamar('/api/pomodoro/iniciar', configBorrador), [llamar, configBorrador]);
  const continuar = useCallback(() => llamar('/api/pomodoro/continuar', {}), [llamar]);
  const parar = useCallback(() => llamar('/api/pomodoro/parar', {}), [llamar]);

  const segundosRestantes = activo && !activo.esperando
    ? Math.max(0, Math.round((activo.finEn - ahora) / 1000))
    : configBorrador.minutosTrabajo * 60;

  return {
    config: configBorrador,
    setConfig: setConfigBorrador,
    activo: activo && { fase: activo.fase, ronda: activo.ronda, rondas: activo.rondas, esperando: activo.esperando },
    segundosRestantes,
    iniciar,
    continuar,
    parar,
    error,
  };
}

function avisar(titulo, cuerpo) {
  pitido();
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(titulo, { body: cuerpo });
  }
}

function usePomodoroLocal() {
  const [config, setConfig] = useState(CONFIG_POR_DEFECTO);
  const [activo, setActivo] = useState(null); // { fase, ronda, rondas, finEn, esperando } | null
  const [ahora, setAhora] = useState(Date.now());

  useEffect(() => {
    if (!activo || activo.esperando) return undefined;
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activo]);

  useEffect(() => {
    if (!activo || activo.esperando || ahora < activo.finEn) return;

    if (activo.fase === 'trabajo' && activo.ronda >= activo.rondas) {
      avisar('Pomodoro completo', `${activo.rondas} rondas hechas. Buen trabajo.`);
      setActivo(null);
      return;
    }

    const siguienteFase = activo.fase === 'trabajo' ? 'descanso' : 'trabajo';
    const siguienteRonda = activo.fase === 'descanso' ? activo.ronda + 1 : activo.ronda;
    avisar(
      siguienteFase === 'descanso' ? 'Descanso' : 'Descanso terminado',
      siguienteFase === 'descanso'
        ? `Toca descansar ${config.minutosDescanso} min. Sigue cuando quieras.`
        : `Ronda ${siguienteRonda} de ${activo.rondas} cuando estés listo.`,
    );
    setActivo((a) => a && { ...a, fase: siguienteFase, ronda: siguienteRonda, esperando: true, finEn: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ahora]);

  const iniciar = useCallback(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    setAhora(Date.now());
    setActivo({
      fase: 'trabajo',
      ronda: 1,
      rondas: config.rondas,
      finEn: Date.now() + config.minutosTrabajo * 60_000,
      esperando: false,
    });
  }, [config]);

  const continuar = useCallback(() => {
    setAhora(Date.now());
    setActivo((a) => {
      if (!a) return a;
      const minutos = a.fase === 'trabajo' ? config.minutosTrabajo : config.minutosDescanso;
      return { ...a, esperando: false, finEn: Date.now() + minutos * 60_000 };
    });
  }, [config]);

  const parar = useCallback(() => setActivo(null), []);

  const segundosRestantes = activo && !activo.esperando
    ? Math.max(0, Math.round((activo.finEn - ahora) / 1000))
    : config.minutosTrabajo * 60;

  return { config, setConfig, activo, segundosRestantes, iniciar, continuar, parar, error: null };
}
