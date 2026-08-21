/**
 * Arranca el cerebro y la interfaz a la vez, y los para juntos con Ctrl+C.
 * Sin esto hacen falta dos terminales y acordarse del orden.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (!existsSync(resolve(raiz, 'server/.env'))) {
  console.error(
    '\n  Falta server/.env\n\n' +
      '  Copia server/.env.example a server/.env y pega tu clave de Anthropic.\n' +
      '  Sin eso el calendario funciona, pero el asistente no.\n',
  );
  process.exit(1);
}

// Con --host, Vite escucha en la red local y la app se abre desde el movil.
// El servidor no hace falta exponerlo: el proxy de Vite le llama desde el Mac.
const enRed = process.argv.includes('--host');

const procesos = [
  spawn('npm', ['run', 'dev'], { cwd: resolve(raiz, 'server'), stdio: 'inherit', shell: false }),
  spawn('npm', ['run', enRed ? 'dev:lan' : 'dev'], { cwd: raiz, stdio: 'inherit', shell: false }),
];

const parar = () => procesos.forEach((p) => p.kill('SIGINT'));
process.on('SIGINT', parar);
process.on('SIGTERM', parar);
procesos.forEach((p) => p.on('exit', parar));
