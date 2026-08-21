/**
 * Cada familia de modelos acepta una configuracion distinta de razonamiento.
 * Mandarle a Haiku lo que espera Opus devuelve un 400, asi que el modelo se
 * elige en el .env y aqui se traduce a los parametros que ese modelo entiende.
 */

/** Modelos con razonamiento adaptativo: el modelo decide cuánto piensa. */
const ADAPTATIVO = /^claude-(opus-(5|4-8|4-7|4-6)|sonnet-(5|4-6)|fable-5|mythos-5)\b/;

/** Modelos con reintento automático en otro modelo si un clasificador rechaza. */
const CON_RESPALDO = /^claude-(opus-5|fable-5|mythos-5)\b/;

export function parametrosDe(modelo, maxTokens) {
  if (ADAPTATIVO.test(modelo)) {
    const extra = { thinking: { type: 'adaptive' } };
    if (CON_RESPALDO.test(modelo)) {
      extra.betas = ['server-side-fallback-2026-07-01'];
      extra.fallbacks = 'default';
    }
    return extra;
  }

  // Haiku 4.5, Sonnet 4.5 y anteriores: presupuesto fijo. Le damos margen para
  // que resuelva bien las fechas relativas, que es donde mas se equivoca.
  return { thinking: { type: 'enabled', budget_tokens: Math.min(3000, maxTokens - 1000) } };
}

/** Con betas hay que ir por el endpoint beta; sin ellas, por el normal. */
export function esBeta(extra) {
  return Array.isArray(extra.betas) && extra.betas.length > 0;
}
