import { useEffect, useState } from 'react';

import { suscribirTareas } from '../services/tareasRepository';

/** Las tareas de un día, escuchando en vivo. Mismo `listo` que useEventos.js. */
export function useTareas(fecha, listo = true) {
  const [tareas, setTareas] = useState([]);

  useEffect(() => {
    if (!listo) return undefined;
    return suscribirTareas(fecha, setTareas, () => {});
  }, [fecha, listo]);

  return tareas;
}
