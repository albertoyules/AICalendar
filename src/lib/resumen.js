import { DIAS_CORTOS, claveDe, horaDe } from './fechas.js';

const MAX_EVENTOS_DIA = 5;
const MAX_CARACTERES_SEMANA = 220;

/**
 * El texto de un aviso de un solo día, para la notificación push de las 9.
 * A propósito muy parecido a la apertura del chat ("Hoy tienes N cosas..."),
 * pero es una función de texto plano aparte: la del chat mezcla JSX con
 * negritas y no vale la pena arriesgar esa pantalla, ya probada, por compartir
 * código con algo que ni siquiera se ve en el navegador.
 */
export function resumenDia(eventos) {
  if (eventos.length === 0) return 'Nada apuntado para hoy.';

  const nombrados = eventos.slice(0, MAX_EVENTOS_DIA).map((e) => {
    const hora = horaDe(e.inicio);
    return hora ? `${e.titulo} a las ${hora}` : e.titulo;
  });
  const restantes = eventos.length - nombrados.length;
  const lista = restantes > 0 ? `${nombrados.join(', ')} y ${restantes} más` : nombrados.join(', ');

  return `Tienes ${eventos.length} ${eventos.length === 1 ? 'cosa' : 'cosas'}: ${lista}.`;
}

/**
 * El texto del briefing semanal de los lunes: una línea por día con eventos,
 * los vacíos se omiten. Es un resumen para abrir la app, no la agenda entera
 * — por eso se recorta si se hace demasiado largo.
 */
export function resumenSemana(dias, porDia) {
  const lineas = dias
    .map((clave, i) => {
      const eventos = porDia[clave] ?? [];
      if (eventos.length === 0) return null;
      const primero = eventos[0];
      const hora = horaDe(primero.inicio);
      const resto = eventos.length > 1 ? ` +${eventos.length - 1}` : '';
      return `${DIAS_CORTOS[i]}: ${primero.titulo}${hora ? ` ${hora}` : ''}${resto}`;
    })
    .filter(Boolean);

  if (lineas.length === 0) return 'Semana tranquila, no tienes nada apuntado.';

  let texto = lineas.join(' · ');
  if (texto.length > MAX_CARACTERES_SEMANA) {
    texto = `${texto.slice(0, MAX_CARACTERES_SEMANA - 1)}…`;
  }
  return texto;
}

/** Agrupa una lista de eventos por su fecha ('YYYY-MM-DD'). */
export function agruparPorDia(eventos) {
  const indice = {};
  for (const evento of eventos) {
    const clave = claveDe(evento.inicio);
    (indice[clave] ??= []).push(evento);
  }
  for (const clave of Object.keys(indice)) indice[clave].sort((a, b) => a.inicio.localeCompare(b.inicio));
  return indice;
}
