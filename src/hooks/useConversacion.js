import { useCallback, useMemo, useRef, useState } from 'react';

import { conversar, textoDe } from '../services/ia';

/**
 * Estado de la conversacion con la IA.
 *
 * Guardamos el historial en el formato crudo de la API (con sus bloques de
 * herramientas y de razonamiento) porque es lo que hay que reenviar en cada
 * turno. Lo que se pinta se deriva de ahi.
 */
export function useConversacion() {
  const [historial, setHistorial] = useState([]);
  const [estado, setEstado] = useState('listo'); // listo | pensando | trabajando
  const [herramienta, setHerramienta] = useState(null);
  const [error, setError] = useState(null);
  const enCurso = useRef(false);

  const enviar = useCallback(
    async (texto) => {
      const limpio = texto.trim();
      if (!limpio || enCurso.current) return;

      enCurso.current = true;
      setError(null);
      setEstado('pensando');

      // Pintamos el mensaje del usuario ya, sin esperar a la respuesta.
      const conElUsuario = [...historial, { role: 'user', content: limpio }];
      setHistorial(conElUsuario);

      try {
        const { mensajes } = await conversar(conElUsuario, (nombre) => {
          setHerramienta(nombre);
          setEstado(nombre ? 'trabajando' : 'pensando');
        });
        setHistorial(mensajes);
      } catch (fallo) {
        setError(fallo.message);
        // El turno del usuario se queda visible: puede reintentar sin reescribir.
      } finally {
        enCurso.current = false;
        setHerramienta(null);
        setEstado('listo');
      }
    },
    [historial],
  );

  /** Descartar el aviso sin perder la conversación. */
  const descartarError = useCallback(() => setError(null), []);

  const reiniciar = useCallback(() => {
    if (enCurso.current) return;
    setHistorial([]);
    setError(null);
  }, []);

  /** Lo que se pinta: los turnos con texto. Las herramientas quedan por debajo. */
  const visibles = useMemo(
    () =>
      historial
        .map((mensaje, i) => {
          if (mensaje.role === 'user') {
            if (typeof mensaje.content !== 'string') return null; // resultados de herramienta
            return { id: i, quien: 'usuario', texto: mensaje.content };
          }
          const texto = textoDe(mensaje.content);
          return texto ? { id: i, quien: 'ia', texto } : null;
        })
        .filter(Boolean),
    [historial],
  );

  return {
    visibles,
    estado,
    herramienta,
    error,
    enviar,
    reiniciar,
    descartarError,
    hayConversacion: visibles.length > 0,
  };
}
