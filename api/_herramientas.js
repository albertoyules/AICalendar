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
        repetir: {
          type: 'object',
          description:
            'Solo si el usuario pide algo que se repite: "todos los días", "cada martes", "todas las semanas". Omite este campo por completo para un evento suelto.',
          properties: {
            frecuencia: {
              type: 'string',
              enum: ['diaria', 'semanal'],
              description: '"diaria" para todos los días, "semanal" para un día concreto de la semana.',
            },
            dias: {
              type: 'array',
              items: { type: 'integer', minimum: 0, maximum: 6 },
              description:
                'Solo con frecuencia semanal. Día de la semana: lunes=0 ... domingo=6. Si no se indica, se usa el día de la semana de "inicio".',
            },
            hasta: {
              type: 'string',
              description:
                'Opcional, "YYYY-MM-DD". Si no se da, se repite varios meses hacia delante sin que haga falta preguntar por cuánto tiempo.',
            },
          },
          required: ['frecuencia'],
        },
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
      'Elimina un evento suelto. Es irreversible: no la uses si hay cualquier duda sobre a cuál se refiere el usuario. Pregunta antes. Si el evento pertenece a una serie repetida (tiene serieId) y el usuario quiere borrar TODAS las ocurrencias, usa borrar_serie en su lugar, no la borres una a una.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'El id que devolvió consultar_agenda.' },
      },
      required: ['id'],
    },
  },
  {
    name: 'borrar_serie',
    description:
      'Elimina TODAS las ocurrencias de un evento repetido de golpe (por ejemplo, "quita el gimnasio de los lunes para siempre"). Irreversible y de más alcance que borrar_evento: confirma con el usuario antes si hay la más mínima duda.',
    input_schema: {
      type: 'object',
      properties: {
        serieId: { type: 'string', description: 'El serieId que devolvió consultar_agenda en ese evento.' },
      },
      required: ['serieId'],
    },
  },
];
