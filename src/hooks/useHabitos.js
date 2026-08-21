import { useEffect, useState } from 'react';

import { suscribirHabitos } from '../services/habitosRepository';

/**
 * Hábitos del usuario, escuchando en vivo. `listo` evita suscribirse antes de
 * saber si hay sesión — misma carrera que resuelve useEventos.js.
 */
export function useHabitos(listo = true) {
  const [habitos, setHabitos] = useState([]);

  useEffect(() => {
    if (!listo) return undefined;
    return suscribirHabitos(setHabitos, () => {});
  }, [listo]);

  return habitos;
}
