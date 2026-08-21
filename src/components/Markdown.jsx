import { CATEGORIAS, coloresDe } from '../config/categorias';

/**
 * Formato mínimo para las respuestas de la IA. Dos cosas y ninguna más:
 *
 *   **negrita**
 *   [[categoria|texto]]  ->  el nombre de un evento, con el color de su categoría
 *
 * La marca de categoría la pone el modelo, no la adivinamos comparando el
 * texto con los títulos guardados: él sabe que "Práctica 1" es la entrega
 * llamada "Entrega Práctica 1", y nosotros solo veríamos dos cadenas distintas.
 *
 * Si el modelo se olvida de marcar o se inventa una categoría, la frase se
 * pinta en plano. Peor, pero nunca rota.
 */
const PATRON = /\*\*(.+?)\*\*|\[\[([A-Za-zÁÉÍÓÚáéíóú]+)\|([^\]]+)\]\]/g;

export default function Markdown({ texto, oscuro }) {
  const trozos = [];
  let ultimo = 0;

  for (const encaje of texto.matchAll(PATRON)) {
    if (encaje.index > ultimo) trozos.push(texto.slice(ultimo, encaje.index));

    const [completo, negrita, categoriaBruta, nombre] = encaje;

    if (negrita !== undefined) {
      trozos.push(
        <strong key={encaje.index} className="font-semibold">
          {negrita}
        </strong>,
      );
    } else {
      const id = categoriaBruta.toLowerCase();
      if (CATEGORIAS[id]) {
        const c = coloresDe(id, oscuro);
        trozos.push(
          <span
            key={encaje.index}
            className="font-medium"
            style={{
              color: c.texto,
              textDecoration: 'underline',
              textDecorationColor: CATEGORIAS[id].punto,
              textDecorationThickness: '1.5px',
              textUnderlineOffset: '3px',
            }}
          >
            {nombre}
          </span>,
        );
      } else {
        trozos.push(nombre); // categoría desconocida: al menos que se lea
      }
    }

    ultimo = encaje.index + completo.length;
  }

  if (ultimo < texto.length) trozos.push(texto.slice(ultimo));
  return <>{trozos}</>;
}

/** Quita las marcas de un texto. Para que nunca acaben dentro de un título. */
export function sinMarcas(texto) {
  return String(texto).replace(PATRON, (_, negrita, __, nombre) => negrita ?? nombre);
}
