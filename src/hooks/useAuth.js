import { useEffect, useState } from 'react';

import { hayFirebase } from '../config/firebase';
import { establecerUsuario, migrarDesdeLocal } from '../services/eventosRepository';
import { establecerUsuario as establecerUsuarioHabitos } from '../services/habitosRepository';
import { establecerUsuario as establecerUsuarioTareas } from '../services/tareasRepository';
import { observarSesion } from '../services/auth';

/**
 * Sesión del usuario.
 *
 * Sin Firebase configurado no hay login: la app arranca en modo local y
 * `usuario` se queda en null para siempre. Con Firebase, hasta que no sepamos
 * si hay sesión no pintamos nada, para no enseñar la pantalla de entrar a
 * alguien que ya estaba dentro.
 */
export function useAuth() {
  const [usuario, setUsuario] = useState(null);
  const [comprobando, setComprobando] = useState(hayFirebase);

  useEffect(() => {
    return observarSesion(async (nuevo) => {
      establecerUsuario(nuevo?.uid ?? null);
      establecerUsuarioHabitos(nuevo?.uid ?? null);
      establecerUsuarioTareas(nuevo?.uid ?? null);
      if (nuevo) await migrarDesdeLocal();
      setUsuario(nuevo);
      setComprobando(false);
    });
  }, []);

  return { usuario, comprobando, hacenFaltaCredenciales: hayFirebase };
}
