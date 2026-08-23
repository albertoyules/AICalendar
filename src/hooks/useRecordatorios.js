import { useEffect, useState } from 'react';

import { suscribirRecordatorios } from '../services/recordatoriosRepository';

/**
 * Recordatorios del usuario, escuchando en vivo. `listo` evita suscribirse
 * antes de saber si hay sesión — misma carrera que resuelve useHabitos.js.
 */
export function useRecordatorios(listo = true) {
  const [recordatorios, setRecordatorios] = useState([]);

  useEffect(() => {
    if (!listo) return undefined;
    return suscribirRecordatorios(setRecordatorios, () => {});
  }, [listo]);

  return recordatorios;
}
