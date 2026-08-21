/**
 * Las cuatro categorias de la vida que quiero controlar.
 *
 * Cada una lleva su color en dos temas. Los valores salen de oklch con la misma
 * luminosidad y saturacion, variando solo el matiz: por eso ninguna categoria
 * grita mas que otra cuando el mes esta lleno.
 */
export const CATEGORIAS = {
  universidad: {
    id: 'universidad',
    nombre: 'Universidad',
    punto: '#6e65c5',
    claro: { fondo: '#ebebfd', texto: '#484188', borde: '#d6d6f9' },
    oscuro: { fondo: '#2b2948', texto: '#b6b2fa', borde: '#3d3a63' },
  },
  trabajo: {
    id: 'trabajo',
    nombre: 'Trabajo',
    punto: '#0083b4',
    claro: { fondo: '#ddf1f9', texto: '#00587c', borde: '#b9e2f2' },
    oscuro: { fondo: '#033342', texto: '#6cc9e8', borde: '#0a4a5e' },
  },
  salud: {
    id: 'salud',
    nombre: 'Salud',
    punto: '#008e5f',
    claro: { fondo: '#dff2e9', texto: '#00603d', borde: '#bee5d2' },
    oscuro: { fondo: '#0b3627', texto: '#6fd4aa', borde: '#134d39' },
  },
  random: {
    id: 'random',
    nombre: 'Random',
    punto: '#b35800',
    claro: { fondo: '#fae9de', texto: '#7b3700', borde: '#f4d3bd' },
    oscuro: { fondo: '#432610', texto: '#f0a877', borde: '#5d3819' },
  },
};

export const LISTA_CATEGORIAS = Object.values(CATEGORIAS);

/** Categoria por defecto cuando algo no encaja en ningun sitio. */
export const CATEGORIA_POR_DEFECTO = 'random';

export function categoria(id) {
  return CATEGORIAS[id] ?? CATEGORIAS[CATEGORIA_POR_DEFECTO];
}

/** Colores de una categoria ya resueltos para el tema activo. */
export function coloresDe(id, oscuro) {
  const cat = categoria(id);
  return oscuro ? cat.oscuro : cat.claro;
}
