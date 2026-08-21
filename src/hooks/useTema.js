import { useCallback, useEffect, useState } from 'react';

const CLAVE = 'iacalendar.tema';

/**
 * Tema claro/oscuro. Tres estados: 'claro', 'oscuro' y 'sistema'.
 *
 * Por defecto seguimos al sistema operativo, que es lo que espera cualquiera
 * hoy en dia; en cuanto el usuario toca el interruptor, su eleccion manda y se
 * recuerda. Pone la clase .oscuro en <html>, que es de donde cuelgan las
 * variables de color de index.css.
 */
export function useTema() {
  const [preferencia, setPreferencia] = useState(() => localStorage.getItem(CLAVE) ?? 'sistema');
  const [sistemaOscuro, setSistemaOscuro] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const alCambiar = (e) => setSistemaOscuro(e.matches);
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);

  const oscuro = preferencia === 'sistema' ? sistemaOscuro : preferencia === 'oscuro';

  useEffect(() => {
    document.documentElement.classList.toggle('oscuro', oscuro);
  }, [oscuro]);

  const alternar = useCallback(() => {
    setPreferencia((actual) => {
      const siguiente =
        (actual === 'sistema' ? sistemaOscuro : actual === 'oscuro') ? 'claro' : 'oscuro';
      localStorage.setItem(CLAVE, siguiente);
      return siguiente;
    });
  }, [sistemaOscuro]);

  return { oscuro, alternar };
}
