import { useEffect, useState } from 'react';

/**
 * Por debajo de 768px cambiamos de maquetación entera, no solo de tamaños:
 * en el móvil la app es una agenda del día con el micro grande, no un
 * calendario mensual encogido.
 */
const CONSULTA = '(max-width: 767px)';

export function useEsMovil() {
  const [esMovil, setEsMovil] = useState(() => window.matchMedia(CONSULTA).matches);

  useEffect(() => {
    const mq = window.matchMedia(CONSULTA);
    const alCambiar = (e) => setEsMovil(e.matches);
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);

  return esMovil;
}
