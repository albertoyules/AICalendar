/**
 * Las herramientas que la IA puede usar sobre el calendario.
 *
 * Ojo: aqui solo estan DECLARADAS. Quien las ejecuta es el navegador
 * (src/services/ia.js), porque es quien tiene acceso a los datos, ya vivan en
 * Firestore o en localStorage. El servidor nunca toca la agenda: solo piensa.
 */

const FECHA = "Fecha en formato 'YYYY-MM-DD'. Si el evento tiene hora, 'YYYY-MM-DDTHH:mm' en 24 h.";

export const HERRAMIENTAS = [
  {
    name: 'consultar_agenda',
    description:
      'Lee los eventos del calendario entre dos fechas, ambas incluidas. Úsala SIEMPRE antes de responder cualquier pregunta sobre lo que hay agendado, y también antes de crear algo, para poder avisar de solapes o de cosas cercanas que le importen al usuario.',
    input_schema: {
      type: 'object',
      properties: {
        desde: { type: 'string', description: "Primer día del rango, 'YYYY-MM-DD'." },
        hasta: { type: 'string', description: "Último día del rango, 'YYYY-MM-DD'. Incluido." },
      },
      required: ['desde', 'hasta'],
    },
  },
  {
    name: 'crear_evento',
    description:
      'Añade un evento nuevo al calendario. Si el usuario no dice la hora, créalo sin hora en vez de inventarte una.',
    input_schema: {
      type: 'object',
      properties: {
        titulo: {
          type: 'string',
          description:
            'Corto y en la forma en que lo diría el usuario. "Tratamiento", no "Cita de tratamiento médico del usuario".',
        },
        categoria: {
          type: 'string',
          enum: ['universidad', 'trabajo', 'salud', 'random'],
          description:
            'universidad: clases, exámenes, entregas, tutorías. trabajo: turnos, reuniones. salud: médico, tratamientos, gimnasio, medicación. random: recados, gestiones, quedadas, cumpleaños y todo lo demás.',
        },
        inicio: { type: 'string', description: FECHA },
        fin: { type: 'string', description: `Opcional, solo si se sabe cuándo acaba. ${FECHA}` },
        lugar: { type: 'string', description: 'Opcional.' },
        nota: { type: 'string', description: 'Opcional, un detalle suelto que merezca la pena guardar.' },
      },
      required: ['titulo', 'categoria', 'inicio'],
    },
  },
  {
    name: 'editar_evento',
    description:
      'Cambia un evento que ya existe. Necesitas su id, así que consulta la agenda antes si no lo tienes. Manda solo los campos que cambian.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'El id que devolvió consultar_agenda.' },
        titulo: { type: 'string' },
        categoria: { type: 'string', enum: ['universidad', 'trabajo', 'salud', 'random'] },
        inicio: { type: 'string', description: FECHA },
        fin: { type: 'string', description: FECHA },
        lugar: { type: 'string' },
        nota: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'borrar_evento',
    description:
      'Elimina un evento. Es irreversible: no la uses si hay cualquier duda sobre a cuál se refiere el usuario. Pregunta antes.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'El id que devolvió consultar_agenda.' },
      },
      required: ['id'],
    },
  },
];
