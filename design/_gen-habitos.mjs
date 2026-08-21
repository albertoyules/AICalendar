import { writeFileSync } from 'node:fs';

const dias = [
  ['Ma', 15], ['Mi', 16], ['Ju', 17], ['Vi', 18], ['Vi', 19], ['Sá', 20], ['Lu', 21],
];
// Corrijo las iniciales: 15 sep 2026 es martes, asi que la semana rueda hasta el lunes 21.
dias[0][0] = 'Ma'; dias[1][0] = 'Mi'; dias[2][0] = 'Ju'; dias[3][0] = 'Vi';
dias[4][0] = 'Sá'; dias[5][0] = 'Do'; dias[6][0] = 'Lu';

// 1 = hecho, 0 = fallado, 2 = hoy, pendiente
const habitos = [
  { n: 'Gimnasio',      m: 'Objetivo: 4 por semana', c: '#008e5f', t: '#e3f5ec', d: [1,1,0,1,1,1,2], racha: 3,  mes: 11, meta: 16 },
  { n: 'Estudiar 1 h',  m: 'Objetivo: 5 por semana', c: '#6e65c5', t: '#eeeeff', d: [1,1,1,1,0,0,1], racha: 1,  mes: 14, meta: 20 },
  { n: 'Medicación',    m: 'Todos los días',         c: '#0083b4', t: '#e1f4fb', d: [1,1,1,1,1,1,2], racha: 18, mes: 20, meta: 21 },
  { n: 'Leer 20 min',   m: 'Objetivo: 3 por semana', c: '#b35800', t: '#fdede3', d: [0,1,0,0,1,0,2], racha: 0,  mes: 5,  meta: 12 },
];

const check = '<svg width="15" height="15" viewBox="0 0 24 24" style="fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round;"><path d="M4 12.5l5 5L20 6.5"></path></svg>';

function celda(estado, color) {
  if (estado === 1) {
    return `<div style="width: 34px; height: 34px; border-radius: 10px; background: ${color}; color: #FFFFFF; display: flex; align-items: center; justify-content: center;">${check}</div>`;
  }
  if (estado === 2) {
    return `<div style="width: 34px; height: 34px; border-radius: 10px; border: 1.5px dashed ${color}; opacity: 0.5;"></div>`;
  }
  return `<div style="width: 34px; height: 34px; border-radius: 10px; background: #F2EEE9;"></div>`;
}

const filas = habitos.map((h, i) => {
  const pct = Math.round((h.mes / h.meta) * 100);
  const rachaBox = h.racha > 0
    ? `<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 1px;">
         <span style="font-family: 'Instrument Serif', Georgia, serif; font-size: 30px; line-height: 1; color: ${h.c};">${h.racha}</span>
         <span style="font-size: 10.5px; color: #9C9792;">${h.racha === 1 ? 'día' : 'días'} seguidos</span>
       </div>`
    : `<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 1px;">
         <span style="font-family: 'Instrument Serif', Georgia, serif; font-size: 30px; line-height: 1; color: #C4BFB8;">0</span>
         <span style="font-size: 10.5px; color: #C4BFB8;">racha rota</span>
       </div>`;

  return `
      <div style="display: grid; grid-template-columns: 236px 292px minmax(0, 1fr) 110px; align-items: center; gap: 24px; padding: 18px 22px; ${i > 0 ? 'border-top: 1px solid #F2EEE9;' : ''}">
        <div style="display: flex; align-items: center; gap: 13px; min-width: 0;">
          <span style="width: 10px; height: 10px; border-radius: 50%; background: ${h.c}; flex-shrink: 0;"></span>
          <div style="min-width: 0;">
            <div style="font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${h.n}</div>
            <div style="font-size: 12px; color: #9C9792; margin-top: 2px;">${h.m}</div>
          </div>
        </div>
        <div style="display: flex; gap: 9px;">${h.d.map((e) => celda(e, h.c)).join('')}</div>
        <div style="display: flex; flex-direction: column; gap: 7px; min-width: 0;">
          <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 10px;">
            <span style="font-size: 12px; color: #76716A;">Este mes</span>
            <span style="font-size: 12px; color: #76716A; font-variant-numeric: tabular-nums;">${h.mes} de ${h.meta}</span>
          </div>
          <div style="height: 6px; border-radius: 3px; background: #F2EEE9; overflow: hidden;">
            <div style="width: ${pct}%; height: 6px; border-radius: 3px; background: ${h.c};"></div>
          </div>
        </div>
        ${rachaBox}
      </div>`;
}).join('');

const cabeceraDias = dias.map(([ini, num], i) => `
        <div style="width: 34px; text-align: center;">
          <div style="font-size: 10px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: ${i === 6 ? '#1D1A16' : '#9C9792'};">${ini}</div>
          <div style="font-size: 11.5px; color: ${i === 6 ? '#1D1A16' : '#C4BFB8'}; margin-top: 2px; font-variant-numeric: tabular-nums; font-weight: ${i === 6 ? '600' : '400'};">${num}</div>
        </div>`).join('');

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"><\/script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap">
  <style>
    body { margin: 0; }
    a { color: #484188; text-decoration: none; }
    a:hover { color: #1D1A16; }
    .ico { fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  </style>
</helmet>

<div style="display: flex; flex-direction: column; width: 1040px; height: 760px; background: #F9F6F3; color: #1D1A16; font-family: 'Instrument Sans', system-ui, sans-serif; font-size: 14px; padding: 34px 40px 36px; box-sizing: border-box; overflow: hidden;">

  <!-- cabecera -->
  <div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 26px;">
    <div>
      <h1 style="margin: 0; font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; font-size: 36px; line-height: 1; letter-spacing: -0.01em;">Hábitos</h1>
      <p style="margin: 8px 0 0; font-size: 13.5px; color: #76716A;">Últimos siete días &middot; 15 &ndash; 21 de septiembre</p>
    </div>
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="height: 34px; padding: 0 14px; border-radius: 9px; border: 1px solid #EBE7E2; background: #FFFFFF; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500;">
        <svg width="15" height="15" viewBox="0 0 24 24" class="ico"><path d="M12 5v14M5 12h14"></path></svg>
        <span>Nuevo hábito</span>
      </div>
    </div>
  </div>

  <!-- tabla -->
  <div style="background: #FFFFFF; border: 1px solid #EBE7E2; border-radius: 16px; overflow: hidden;">

    <div style="display: grid; grid-template-columns: 236px 292px minmax(0, 1fr) 110px; align-items: end; gap: 24px; padding: 16px 22px 12px; border-bottom: 1px solid #F2EEE9; background: #FCFAF7;">
      <div style="font-size: 10.5px; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; color: #9C9792;">Hábito</div>
      <div style="display: flex; gap: 9px;">${cabeceraDias}</div>
      <div style="font-size: 10.5px; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; color: #9C9792;">Progreso</div>
      <div style="font-size: 10.5px; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; color: #9C9792; text-align: right;">Racha</div>
    </div>
${filas}
  </div>

  <div style="flex-grow: 1;"></div>

  <!-- lectura de la IA -->
  <div style="display: flex; gap: 14px; align-items: flex-start; background: #FFFFFF; border: 1px solid #EBE7E2; border-radius: 16px; padding: 18px 20px;">
    <svg width="18" height="18" viewBox="0 0 24 24" style="fill: #1D1A16; flex-shrink: 0; margin-top: 2px;"><path d="M12 2.6l2.05 5.9 5.9 2.05-5.9 2.05L12 18.5l-2.05-5.9L4.05 10.55l5.9-2.05z"></path></svg>
    <div style="flex-grow: 1;">
      <div style="font-size: 14px; line-height: 1.55;">Los <strong style="font-weight: 600;">viernes</strong> son tu punto débil: has fallado el gimnasio tres de los últimos cuatro. Coinciden con tu turno de 16:00 a 22:00.</div>
      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <div style="background: #1D1A16; color: #FCFAF7; border-radius: 999px; padding: 7px 15px; font-size: 12.5px; font-weight: 500;">Mover el viernes a las 11:00</div>
        <div style="border: 1px solid #EBE7E2; border-radius: 999px; padding: 7px 15px; font-size: 12.5px; color: #514C46;">Bajar el objetivo a 3</div>
      </div>
    </div>
  </div>

</div>
</x-dc>
</body>
</html>
`;

writeFileSync('Habitos.dc.html', html);
console.log('Habitos.dc.html', html.length, 'bytes');
