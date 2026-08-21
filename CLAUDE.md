# IA Calendar

Calendario personal donde la IA es la interfaz: le hablas o le escribes en
lenguaje natural y ella crea, mueve y avisa de los eventos. Cuatro categorías
(Universidad, Trabajo, Salud, Random), voz en las dos direcciones, sesión con
Google, desplegado en Vercel. Todo el proyecto — código, comentarios,
commits — está en español; sigue esa convención al tocarlo.

Para instrucciones de instalación, variables de entorno y despliegue, lee
`README.md`. Esto es el mapa para trabajar en el código.

## Arquitectura: dos runtimes, un solo cerebro

El asistente vive en dos sitios que **comparten la misma lógica**:

- **`api/`** — funciones de Vercel, lo que corre en producción. `api/chat.js`
  es la ruta HTTP; los ficheros que empiezan por `_` (`_cerebro.js`,
  `_herramientas.js`, `_prompt.js`, `_modelo.js`) no son rutas, son la lógica.
- **`server/`** — Express en local, para trabajar sin desplegar. Llama a
  `api/_cerebro.js` con un `../../` en el import. No se sube a producción.

**Nunca dupliques lógica entre los dos.** Si tocas cómo piensa el asistente,
edita `api/_cerebro.js` (o los ficheros `_` que importa) y los dos runtimes lo
heredan solos.

El bucle de agente (ejecutar las herramientas que pide Claude) vive en
**el navegador**, no en el servidor — `src/services/ia.js`. El servidor solo
tiene la clave y piensa; el navegador es quien puede tocar la agenda, esté en
Firestore o en localStorage.

## Datos: Firestore con caída a localStorage

`src/services/eventosRepository.js` es la única puerta a los eventos. Detrás
hay dos implementaciones:

- Con Firebase configurado y sesión iniciada: `usuarios/{uid}/eventos`.
- Sin credenciales, o sin sesión: `localStorage`.

**Esto es intencional, no un resto de desarrollo — consérvalo.** Permite
trastear con la app sin montar Firebase. `hayFirebase` (en
`src/config/firebase.js`) y `establecerUsuario()` gobiernan el cambio.

Las fechas viajan siempre como texto — `'YYYY-MM-DD'` o
`'YYYY-MM-DDTHH:mm'` — nunca como `Date` en el almacén. Al ser ordenables
alfabéticamente, los rangos funcionan igual en Firestore que en memoria, y se
evita el infierno de zonas horarias. Toda la aritmética de fechas vive en
`src/lib/fechas.js`; no reimplementes cálculos de semana o mes fuera de ahí.

## El contrato entre el prompt y el renderizado

`api/_prompt.js` le enseña al modelo a marcar los eventos que menciona con
`[[categoria|texto]]`. `src/components/Markdown.jsx` pinta esa marca con el
color de la categoría. **Si tocas uno, mira el otro** — es un contrato
implícito entre dos ficheros que no se importan mutuamente.

## Cambiar de modelo no es solo cambiar el nombre

`api/_modelo.js` traduce el modelo elegido (`ANTHROPIC_MODEL`) a los
parámetros de razonamiento que ese modelo entiende. Opus/Sonnet aceptan
`thinking: {type: 'adaptive'}`; Haiku necesita `budget_tokens`. Mandarle a uno
la config del otro devuelve un 400. Si añades un modelo nuevo, pasa por ahí.

Modelo por defecto: `claude-haiku-4-5`, elegido por coste. Es notablemente
peor que Opus calculando fechas relativas — por eso `api/_prompt.js` no le
pide que cuente días: recibe la tabla de esta semana y la siguiente ya escrita
día por día (`semanaActual`/`semanaProxima` en el contexto que arma
`src/services/ia.js`). Si vuelven a bailar fechas, mira ahí antes que el
prompt.

## Voz: coste cero a propósito

`src/hooks/useDictado.js` y `src/hooks/useVoz.js` usan las APIs nativas del
navegador (`SpeechRecognition` y `speechSynthesis`), no Whisper ni una voz de
pago. Es una decisión de producto, no una limitación técnica — no lo cambies
sin que te lo pidan. Firefox no tiene `SpeechRecognition`: ahí el micro se
oculta solo y queda el teclado.

## Móvil: maquetación propia, no la de escritorio encogida

Por debajo de 768px (`src/hooks/useEsMovil.js`) `App.jsx` bifurca a una
estructura distinta — agenda del día en vez de mes, micro grande abajo, mes
como mapa de puntos. No es CSS responsive sobre los mismos componentes de
escritorio: son pantallas diferentes que comparten los mismos datos. Todo
blanco táctil debe ser ≥44px.

## Paleta: crema, nunca blanco puro

Las superficies deslumbraban en blanco (`#fff`). Ahora todo cuelga de las
variables de `src/index.css` (`--papel`, `--superficie`, etc.). **No
hardcodees colores** — ni `#fff`, ni hex sueltos — usa las variables, y si
añades una superficie nueva, que salga de ahí.

## Seguridad

- `ANTHROPIC_API_KEY` vive solo en el servidor (`server/.env` en local, la
  variable de entorno de Vercel en producción — **sin** prefijo `VITE_`,
  o se incrustaría en el JavaScript público). Se limpia de espacios sola en
  `api/_cerebro.js::claveLimpia()` — un salto de línea al pegarla en un panel
  es facilísimo de colar.
- Las variables `VITE_FIREBASE_*` sí van en el cliente — no son secretas, las
  protege `firestore.rules`, no ocultarlas.
- `firestore.rules` ata cada evento a `request.auth.uid`. Si cambias el
  esquema de datos, actualiza las reglas en el mismo cambio y vuelve a
  publicarlas (`npm run reglas`).
- `/api/salud?probar=1` diagnostica la configuración sin exponer secretos.

## Cómo trabajar aquí

```bash
npm run setup      # instala app + servidor
npm run dev:all     # calendario + asistente en local
npm run dev:movil   # lo mismo, accesible desde el móvil por wifi
npx vite build       # compila; úsalo para comprobar que no rompiste nada
```

No hay tests automatizados todavía. Antes de dar por bueno un cambio, arranca
`dev:all` y pruébalo con Playwright headless o pídelo al usuario.

## Estado y lo que falta

Hechas: calendario (mes/semana), alta y edición manual, asistente por texto y
voz con herramientas, sesión con Google, Firestore por usuario, móvil,
despliegue en Vercel.

Sin construir: hábitos (hay maqueta en `design/Habitos.dc.html`, sin código),
eventos recurrentes (no existe el concepto en el esquema de datos), avisos
push, canal externo (WhatsApp/Telegram). Detalle de cada uno en la sección
«Próximos pasos» de `README.md`.

## Diseño

Maquetas fuente en `design/*.dc.html`, editables con la skill `design`.
Lienzo publicado: https://claude.ai/code/artifact/9af90c41-b1d9-4543-8532-67a8ec2d2e79
No edites `design/ia-calendar.html` a mano — se regenera desde los `.dc.html`
con `seed-canvas.mjs` (ver `design/_gen-*.mjs` como referencia de cómo se
generó el contenido dinámico de esos artboards).
