import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Dictado con el reconocimiento de voz del propio navegador.
 *
 * Se podría grabar el audio y mandarlo a transcribir (Whisper y compañía),
 * pero esto es gratis, va en español de fábrica y va escribiendo mientras
 * hablas, que se siente mucho mejor que esperar a que suba un fichero.
 *
 * Funciona en Chrome, Edge y Safari, también en el iPhone. Firefox no lo
 * lleva: ahí el micro se esconde y queda el teclado, que sigue funcionando.
 */
const Reconocimiento = window.SpeechRecognition ?? window.webkitSpeechRecognition;

export const hayDictado = Boolean(Reconocimiento);

export function useDictado({ alTerminar } = {}) {
  const [escuchando, setEscuchando] = useState(false);
  const [parcial, setParcial] = useState('');
  const [error, setError] = useState(null);

  const motor = useRef(null);
  const texto = useRef('');
  // Lo que el navegador aun no ha dado por definitivo. Si paras de hablar
  // justo antes de que lo confirme, sin esto se perderia la ultima frase.
  const tanteo = useRef('');
  // El callback cambia en cada render; guardarlo en una ref evita tener que
  // recrear el motor de reconocimiento cada vez.
  const alTerminarRef = useRef(alTerminar);
  alTerminarRef.current = alTerminar;

  useEffect(() => {
    if (!hayDictado) return undefined;

    const r = new Reconocimiento();
    r.lang = 'es-ES';
    r.continuous = true; // no cortar en la primera pausa: la gente titubea
    r.interimResults = true;

    r.onresult = (evento) => {
      let confirmado = '';
      let enTanteo = '';
      for (let i = evento.resultIndex; i < evento.results.length; i += 1) {
        const trozo = evento.results[i][0].transcript;
        if (evento.results[i].isFinal) confirmado += trozo;
        else enTanteo += trozo;
      }
      if (confirmado) texto.current = `${texto.current} ${confirmado}`.trim();
      tanteo.current = enTanteo;
      setParcial(`${texto.current} ${enTanteo}`.trim());
    };

    r.onerror = (evento) => {
      if (evento.error === 'no-speech') return; // callarse no es un fallo
      setError(
        evento.error === 'not-allowed'
          ? 'No me dejas usar el micrófono. Actívalo en los permisos del navegador.'
          : 'El dictado ha fallado. Prueba otra vez.',
      );
      setEscuchando(false);
    };

    r.onend = () => {
      setEscuchando(false);
      const dicho = `${texto.current} ${tanteo.current}`.trim();
      texto.current = '';
      tanteo.current = '';
      setParcial('');
      if (dicho) alTerminarRef.current?.(dicho);
    };

    motor.current = r;
    return () => {
      r.onresult = null;
      r.onerror = null;
      r.onend = null;
      r.abort();
    };
  }, []);

  const empezar = useCallback(() => {
    if (!motor.current || escuchando) return;
    setError(null);
    texto.current = '';
    tanteo.current = '';
    setParcial('');
    try {
      motor.current.start();
      setEscuchando(true);
    } catch {
      // start() protesta si ya estaba arrancando; no es nada.
    }
  }, [escuchando]);

  /** Para y envía lo dicho. */
  const parar = useCallback(() => {
    motor.current?.stop();
  }, []);

  /** Para y tira lo dicho. */
  const cancelar = useCallback(() => {
    texto.current = '';
    tanteo.current = '';
    setParcial('');
    motor.current?.abort();
    setEscuchando(false);
  }, []);

  const alternar = useCallback(() => {
    if (escuchando) parar();
    else empezar();
  }, [escuchando, empezar, parar]);

  return { escuchando, parcial, error, empezar, parar, cancelar, alternar, descartarError: () => setError(null) };
}
