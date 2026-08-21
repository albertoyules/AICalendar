import { useCallback, useEffect, useRef, useState } from 'react';

import { sinMarcas } from '../components/Markdown';

/**
 * Que la IA conteste en voz alta, con la voz del sistema.
 *
 * En Mac y en iPhone las voces españolas son buenas y no cuestan nada. Una
 * voz de pago (ElevenLabs y similares) sonaría mejor, pero para "mañana a las
 * diez tienes tratamiento" esto sobra, y sale gratis.
 *
 * La preferencia se recuerda: si lo apagas, sigue apagado mañana.
 */
const CLAVE = 'iacalendar.voz';
const hayVoz = typeof window !== 'undefined' && 'speechSynthesis' in window;

export { hayVoz };

/** La mejor voz española disponible. Las de Apple suenan bastante mejor. */
function elegirVoz() {
  const voces = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith('es'));
  if (voces.length === 0) return null;
  return (
    voces.find((v) => v.lang === 'es-ES' && /mónica|monica|marisol|premium|enhanced/i.test(v.name)) ??
    voces.find((v) => v.lang === 'es-ES') ??
    voces[0]
  );
}

export function useVoz() {
  const [activada, setActivada] = useState(() => localStorage.getItem(CLAVE) === 'si');
  const [hablando, setHablando] = useState(false);
  const voz = useRef(null);

  useEffect(() => {
    if (!hayVoz) return undefined;
    // En Chrome la lista de voces llega tarde, después de un evento.
    const cargar = () => { voz.current = elegirVoz(); };
    cargar();
    window.speechSynthesis.addEventListener('voiceschanged', cargar);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', cargar);
  }, []);

  const callar = useCallback(() => {
    if (!hayVoz) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Da igual: lo que importa es que la interfaz deje de decir que habla.
    }
    setHablando(false);
  }, []);

  const decir = useCallback(
    (texto) => {
      if (!hayVoz || !activada || !texto) return;
      window.speechSynthesis.cancel(); // nada de encadenar frases viejas

      // Las marcas de categoría son para pintar, no para leer: "corchete
      // corchete universidad barra" no hay quien lo escuche.
      const limpio = sinMarcas(texto);

      // Envuelto porque hablar puede fallar de formas raras —Safari protesta
      // con textos muy largos, y algún navegador exige un gesto del usuario—
      // y que no se lea una frase no puede tumbar el chat entero.
      try {
        const frase = new SpeechSynthesisUtterance(limpio);
        frase.lang = 'es-ES';
        if (voz.current) frase.voice = voz.current;
        frase.rate = 1.05; // un pelín rápido: a velocidad 1 suena a contestador
        frase.onstart = () => setHablando(true);
        frase.onend = () => setHablando(false);
        frase.onerror = () => setHablando(false);
        window.speechSynthesis.speak(frase);
      } catch (error) {
        console.warn('[IA Calendar] no se ha podido leer en voz alta:', error);
        setHablando(false);
      }
    },
    [activada],
  );

  const alternar = useCallback(() => {
    setActivada((antes) => {
      const ahora = !antes;
      localStorage.setItem(CLAVE, ahora ? 'si' : 'no');
      if (!ahora && hayVoz) window.speechSynthesis.cancel();
      return ahora;
    });
  }, []);

  // Si te vas de la página, que no siga hablando sola.
  useEffect(() => () => hayVoz && window.speechSynthesis.cancel(), []);

  return { activada, hablando, decir, callar, alternar };
}
