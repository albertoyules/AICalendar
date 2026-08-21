import { writeFileSync } from 'node:fs';

// Barras de la onda de audio: alturas deterministas, para que la maqueta no cambie entre generaciones.
function wave(n, max, color, w = 2.5, gap = 2.5) {
  let out = `<div style="display: flex; align-items: center; gap: ${gap}px; height: ${max}px;">`;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    // Dos senos desfasados: da un contorno de voz creíble, con arranque y caída suaves.
    const env = Math.sin(Math.PI * t) ** 0.55;
    const detail = 0.45 + 0.55 * Math.abs(Math.sin(i * 1.9) * 0.6 + Math.sin(i * 0.7) * 0.4);
    const h = Math.max(3, Math.round(max * env * detail));
    out += `<span style="width: ${w}px; height: ${h}px; border-radius: 2px; background: ${color}; flex-shrink: 0;"></span>`;
  }
  return out + '</div>';
}

const ico = 'fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round;';

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
    .ico { ${ico} }
  </style>
</helmet>

<div style="display: flex; flex-direction: column; width: 480px; height: 880px; background: #FFFFFF; color: #1D1A16; font-family: 'Instrument Sans', system-ui, sans-serif; font-size: 14px; overflow: hidden;">

  <!-- cabecera -->
  <div style="padding: 22px 24px 16px; border-bottom: 1px solid #F2EEE9; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
    <div style="display: flex; align-items: center; gap: 9px;">
      <svg width="18" height="18" viewBox="0 0 24 24" style="fill: #1D1A16;"><path d="M12 2.6l2.05 5.9 5.9 2.05-5.9 2.05L12 18.5l-2.05-5.9L4.05 10.55l5.9-2.05z"></path></svg>
      <span style="font-size: 15px; font-weight: 600;">Asistente</span>
    </div>
    <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #9C9792;">
      <span style="width: 6px; height: 6px; border-radius: 50%; background: #008e5f;"></span>
      <span>Escuchando</span>
    </div>
  </div>

  <!-- conversacion -->
  <div style="flex-grow: 1; padding: 20px 24px; display: flex; flex-direction: column; justify-content: flex-end; gap: 20px; overflow: hidden;">

    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="flex-grow: 1; height: 1px; background: #F2EEE9;"></div>
      <span style="font-size: 11px; color: #9C9792; letter-spacing: 0.05em; text-transform: uppercase;">Lunes 21</span>
      <div style="flex-grow: 1; height: 1px; background: #F2EEE9;"></div>
    </div>

    <!-- audio del usuario -->
    <div style="display: flex; flex-direction: column; gap: 7px; align-items: flex-end;">
      <div style="background: #1D1A16; border-radius: 16px 16px 5px 16px; padding: 13px 16px; display: flex; align-items: center; gap: 13px;">
        <div style="width: 30px; height: 30px; border-radius: 50%; background: #FCFAF7; color: #1D1A16; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <svg width="12" height="12" viewBox="0 0 24 24" style="fill: currentColor;"><path d="M7 4.5l12 7.5-12 7.5z"></path></svg>
        </div>
        ${wave(30, 26, '#8B857C')}
        <span style="font-size: 11.5px; color: #A8A29A; font-variant-numeric: tabular-nums;">0:07</span>
      </div>
      <div style="max-width: 330px; text-align: right; font-size: 12.5px; line-height: 1.5; color: #9C9792; font-style: italic; padding-right: 4px;">&laquo;tengo tratamiento mañana a las diez, y creo que esa semana entregaba algo de la uni&raquo;</div>
    </div>

    <!-- respuesta de la IA -->
    <div style="display: flex; flex-direction: column; gap: 10px;">

      <div style="background: #F7F4F0; border-radius: 16px 16px 16px 5px; padding: 14px 16px; font-size: 14px; line-height: 1.55;">Apuntado. Y sí, tenías razón con lo de la uni.</div>

      <!-- evento creado -->
      <div style="border: 1px solid #c3e8d7; background: #e3f5ec; border-radius: 13px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <span style="font-size: 15px; font-weight: 600; color: #00603d;">Tratamiento</span>
            <span style="font-size: 12.5px; color: #008e5f;">Martes 22 de septiembre &middot; 10:00 &ndash; 11:00</span>
          </div>
          <div style="width: 24px; height: 24px; border-radius: 50%; background: #008e5f; color: #FFFFFF; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <svg width="13" height="13" viewBox="0 0 24 24" class="ico" style="stroke-width: 2.4;"><path d="M4 12.5l5 5L20 6.5"></path></svg>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="background: #FFFFFF; border: 1px solid #c3e8d7; border-radius: 999px; padding: 3px 10px; font-size: 11.5px; font-weight: 500; color: #00603d;">Salud</span>
          <span style="background: #FFFFFF; border: 1px solid #c3e8d7; border-radius: 999px; padding: 3px 10px; font-size: 11.5px; font-weight: 500; color: #00603d;">Aviso 1 h antes</span>
        </div>
      </div>

      <!-- aviso -->
      <div style="background: #F7F4F0; border-radius: 16px; padding: 14px 16px; font-size: 14px; line-height: 1.55;">El <strong style="font-weight: 600;">jueves 24</strong> entregas la Práctica 1 de Bases de Datos, y ese día trabajas por la tarde. ¿Te reservo el miércoles de 10:00 a 13:00 para terminarla?</div>

      <!-- respuesta hablada -->
      <div style="display: flex; align-items: center; gap: 12px; border: 1px solid #EBE7E2; border-radius: 999px; padding: 8px 16px 8px 10px; align-self: flex-start;">
        <div style="width: 28px; height: 28px; border-radius: 50%; background: #1D1A16; color: #FCFAF7; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <svg width="11" height="11" viewBox="0 0 24 24" style="fill: currentColor;"><path d="M7 4.5l12 7.5-12 7.5z"></path></svg>
        </div>
        ${wave(24, 18, '#C4BFB8', 2.5, 2.5)}
        <span style="font-size: 11.5px; color: #9C9792; font-variant-numeric: tabular-nums;">0:11</span>
      </div>
    </div>

    <!-- acciones -->
    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
      <div style="background: #1D1A16; color: #FCFAF7; border-radius: 999px; padding: 8px 16px; font-size: 13px; font-weight: 500;">Sí, resérvalo</div>
      <div style="border: 1px solid #EBE7E2; border-radius: 999px; padding: 8px 16px; font-size: 13px; color: #514C46;">Mejor el martes</div>
      <div style="border: 1px solid #EBE7E2; border-radius: 999px; padding: 8px 16px; font-size: 13px; color: #514C46;">Déjalo</div>
    </div>
  </div>

  <!-- barra de entrada, grabando -->
  <div style="padding: 16px 20px 22px; border-top: 1px solid #F2EEE9; flex-shrink: 0;">
    <div style="display: flex; align-items: center; gap: 14px; background: #FDF3F2; border: 1px solid #F0D4D1; border-radius: 999px; padding: 9px 9px 9px 18px;">
      <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
        <span style="width: 8px; height: 8px; border-radius: 50%; background: #c74b47;"></span>
        <span style="font-size: 12.5px; font-weight: 600; color: #c74b47; font-variant-numeric: tabular-nums;">0:03</span>
      </div>
      <div style="flex-grow: 1; display: flex; justify-content: center;">${wave(26, 22, '#E0A9A5', 2.5, 3)}</div>
      <div style="width: 40px; height: 40px; border-radius: 50%; background: #c74b47; color: #FFFFFF; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <svg width="18" height="18" viewBox="0 0 24 24" class="ico"><rect x="9" y="2.5" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0M12 18v3"></path></svg>
      </div>
    </div>
    <div style="text-align: center; margin-top: 10px; font-size: 11.5px; color: #9C9792;">Suelta para enviar &middot; desliza para cancelar</div>
  </div>

</div>
</x-dc>
</body>
</html>
`;

writeFileSync('Chat.dc.html', html);
console.log('Chat.dc.html', html.length, 'bytes');
