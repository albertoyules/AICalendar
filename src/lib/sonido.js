/**
 * Un pitido corto generado con Web Audio, sin fichero de sonido en el repo.
 * Lo usan el pomodoro local y el aviso en primer plano de useNotificaciones.js.
 */
export function pitido() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const ganancia = ctx.createGain();
    osc.connect(ganancia);
    ganancia.connect(ctx.destination);
    osc.frequency.value = 880;
    ganancia.gain.setValueAtTime(0.15, ctx.currentTime);
    ganancia.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // Sin Web Audio (Safari antiguo, algún navegador raro): sin sonido, el
    // aviso en pantalla sigue funcionando igual.
  }
}
