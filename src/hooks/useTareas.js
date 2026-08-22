import { useEffect, useState } from 'react';

import { suscribirTareas } from '../services/tareasRepository';

/** Las tareas de un día, escuchando en vivo. Mismo `listo` que useEventos.js. */
export function useTareas(fecha, listo = true) {
  const [tareas, setTareas] = useState([]);
  const [fallo, setFallo] = useState(null);

  useEffect(() => {
    if (!listo) return undefined;
    setFallo(null);
    return suscribirTareas(fecha, setTareas, setFallo);
  }, [fecha, listo]);

  return { tareas, fallo };
}
