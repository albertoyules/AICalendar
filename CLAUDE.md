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

## Eventos recurrentes: sin documento plantilla

Una serie repetida no es un documento aparte — son N eventos normales que
comparten `serieId` (`src/lib/recurrencia.js` genera las fechas, tope de 180
días si no hay fecha de fin). Cada ocurrencia se edita y borra individualmente
con las funciones de siempre; `serieId` solo sirve para `borrarSerie()`.

**Límite real de Haiku, sin arreglo de código**: si no le das fecha de fin al
pedir algo recurrente, tiende a preguntar "¿hasta cuándo?" en vez de usar el
valor por defecto — resistente incluso a que se lo repitas. Probado con
Sonnet, mismo prompt exacto: lo crea a la primera. No sigas puliendo el prompt
para esto; ya se intentó tres veces con refuerzos crecientes y no cede — es el
modelo, no el texto.

## Avisos push: sin Cloud Functions, sin plan Blaze

Enviar por FCM solo necesita llamar a su API con una cuenta de servicio —
cualquier función de `api/` puede hacerlo. `api/_admin.js` inicializa
firebase-admin (perezoso, mismo patrón que `claude()` en `_cerebro.js`);
`api/_avisos.js` manda a todos los dispositivos de un usuario y limpia tokens
muertos; `api/cron/diario.js` y `api/cron/semanal.js` son los dos disparadores
(protegidos por `CRON_SECRET`, que Vercel manda solo en cada invocación).

**Vercel Hobby limita cada Cron a una vez al día, con hasta 59 minutos de
imprecisión** — no hay forma de programar algo más fino sin pasar a Pro. La
hora se fija en UTC (`vercel.json`), así que el cambio de hora en España la
desplaza ~1h dos veces al año; se eligió el horario que acierta en verano
porque cubre más meses. No merece la pena intentar "arreglarlo" con un cron
horario que compruebe la hora local — Hobby rechaza cualquier cron más
frecuente que diario en el propio despliegue.

Un usuario puede tener varios dispositivos: cada uno es un documento en
`usuarios/{uid}/dispositivos/{idLocal}`, con `idLocal` guardado en
`localStorage` del navegador (no en el uid) para que reactivar el permiso no
cree duplicados.

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
- `FIREBASE_SERVICE_ACCOUNT` (el JSON de la cuenta de servicio) es más
  sensible aún que la clave de Anthropic: da acceso de administrador a todo
  el proyecto de Firebase, saltándose `firestore.rules` por completo. Solo en
  variables de entorno de Vercel, nunca en el repo.
- `CRON_SECRET` protege `api/cron/*` de que cualquiera las dispare desde
  fuera — son rutas HTTP públicas como cualquier otra de `api/`.
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

Hechas: calendario (mes/semana/día), alta y edición manual, eventos
recurrentes, asistente por texto y voz con herramientas, sesión con Google,
Firestore por usuario, móvil instalable, avisos push (diario + semanal;
código completo, pendiente de que el usuario complete 3 pasos manuales en
Firebase/Vercel — ver README), despliegue en Vercel, hábitos con rachas,
recordatorio diario a hora exacta por hábito y avisos sueltos "X antes" por
evento (con nota opcional), los dos vía Upstash QStash — código completo,
pendiente de que el usuario cree la cuenta gratuita (ver README). Viewport
móvil fijado (sin zoom, sin que el teclado deforme el layout).

Sin construir: canal externo (WhatsApp/Telegram — decidido: Telegram primero,
reutilizando `api/_cerebro.js::pensar()`), y avisos en eventos repetidos
(una serie no lleva "avísame antes" — multiplicaría los mensajes de QStash
por cada ocurrencia). Detalle de cada uno en «Próximos pasos» del README.
Bug conocido sin arreglar: avisos de hábito duplicados (carrera en el
candado de `api/qstash/recordatorio.js` — ver «Bugs conocidos» del README).

## QStash: quién dispara los avisos de hábito y de evento, y por qué no es Vercel Cron

Los avisos de fase 4 (diario, semanal) usan Vercel Cron porque son "una vez al
día, hora fija de todo el proyecto" — encaja perfecto. Un aviso de hábito a
*su propia* hora no encaja: Vercel Hobby no permite más de un disparo diario
por cron y la hora es la misma para cualquier cron que definas en
`vercel.json`, no algo que puedas variar por usuario u objeto en tiempo de
ejecución. Upstash QStash sí: sus *schedules* se crean y borran por código.

Dos rutas nuevas en `api/`, **fuera** del par cerebro/servidor de siempre —
QStash no tiene equivalente en `server/` porque necesita una URL pública de
verdad, no puede llamar a tu localhost:

- `api/habitos/recordatorio.js` — la llama el navegador (desde
  `habitosRepository.js`) al crear/editar/borrar un hábito con aviso. Verifica
  el idToken de Firebase con `admin.auth().verifyIdToken()` y saca el uid de
  ahí, nunca del cuerpo de la petición — si no, cualquiera podría registrar
  avisos a nombre de otro uid con solo saber el suyo. Da de alta o retira el
  *schedule* en QStash con un id determinista (`idScheduleHabito()` en
  `_qstash.js`): crear con el mismo id sobrescribe el anterior, así que
  cambiar la hora de aviso de un hábito no dispara duplicados.
- `api/qstash/recordatorio.js` — la llama QStash a la hora programada.
  Verifica la firma con `Receiver` de `@upstash/qstash` (nunca te fíes de una
  petición que dice venir de QStash sin comprobarlo) y relee el hábito en
  Firestore antes de mandar el push, en vez de guardar su nombre en el propio
  *schedule* — así si le cambias el nombre después de programar el aviso,
  llega el nombre nuevo.

Toda la identificación (uid, habitoId) viaja en la URL de destino del
*schedule*, no en un cuerpo JSON — evita la ambigüedad de qué acepta la API de
*schedules* de QStash como body, y de paso simplifica la verificación de
firma (con cuerpo vacío no hay nada que serializar mal).

`APP_URL` es una variable nueva, solo para esto: la URL de producción estable
de la app. No uses `VERCEL_URL` (esa cambia con cada despliegue) — un
*schedule* de hábito vive mucho más que un despliegue.

### Eventos: un mensaje suelto, no un *schedule* — y el límite de 7 días

Un aviso de hábito es "todos los días a la misma hora": encaja perfecto en un
*schedule* recurrente de QStash. Un aviso de evento es "una vez, a una hora
suelta que puede caer dentro de un año": eso es un **mensaje** de QStash
(`client.publish({ url, notBefore })`), no un *schedule* — y el plan gratuito
solo admite `notBefore` hasta 7 días vista (`MAX_ADELANTO_SEGUNDOS` en
`_qstash.js`, con medio día de margen).

Tres piezas, mismo reparto que los hábitos (`api/eventos/recordatorio.js` lo
registra desde el navegador con idToken verificado,
`api/qstash/recordatorioEvento.js` es a donde QStash llama de vuelta), más
una nueva por el límite de 7 días:

- Si al guardar el evento el aviso cae dentro de la ventana, se publica al
  momento y se guarda el `messageId` en `recordatorioIdQstash`.
- Si cae más lejos, se deja el evento con `recordatorioMinutosAntes` puesto
  pero sin `recordatorioIdQstash` — **pendiente**, a propósito.
- `api/cron/encolarRecordatorios.js` (cron diario nuevo, en `vercel.json`)
  revisa cada día los próximos ~8 días y programa de verdad los que ya han
  entrado dentro de la ventana de 7. Puede tardar varios días en "recoger" un
  aviso pedido con mucha antelación — es intencional, no un bug.

Al reprogramar (cambia la hora o el propio aviso) o al borrar el evento,
`api/eventos/recordatorio.js` cancela primero el `messageId` anterior con
`client.messages.cancel()` antes de decidir qué hacer con el nuevo — un
mensaje huérfano en QStash no se cancela solo.

`instanteMadrid()` en `api/cron/_comun.js` convierte la hora local que guarda
el evento (`'YYYY-MM-DDTHH:mm'`, sin zona — ver «Datos: Firestore con caída a
localStorage» más arriba) al instante UTC real que necesita `notBefore`, calculando el desfase
horario de Madrid en esa fecha concreta con `Intl.DateTimeFormat`. Sin esto,
un `new Date('...')` sin zona se interpreta en la zona del servidor de
Vercel (UTC), no en la de Madrid, y el aviso llegaría 1-2 horas tarde según
la época del año.

## Hábitos: un documento por hábito, sin subcolección de marcas

`usuarios/{uid}/habitos/{habitoId}` — mismo patrón dual Firestore/localStorage
que los eventos (`habitosRepository.js`, calcado de `eventosRepository.js`).
Las marcas de qué días se cumplió van en un mapa dentro del propio documento
(`marcas: { '2026-08-22': true }`), no en una subcolección: un año de marcas
son 365 claves, no compensa pagar una consulta aparte por algo tan pequeño. Se
alternan con notación de punto (`marcas.2026-08-22`) para no pisar el resto si
dos pestañas tocan el mismo hábito a la vez; borrar una marca usa
`deleteField()`, no `false` — así el mapa no crece para siempre.

Toda la aritmética (racha, meta del mes) vive en `src/lib/habitos.js`, pura y
sin Firestore, igual que `fechas.js` y `recurrencia.js`. La racha cuenta hacia
atrás desde hoy si hoy ya está marcado, o desde ayer si hoy sigue pendiente —
así el día en curso nunca rompe una racha antes de tiempo. La meta del mes
prorratea el objetivo semanal sobre los días transcurridos
(`Math.round(diasTranscurridos / 7 * objetivoSemanal)`), en vez de contar días
del mes a secas, para que un objetivo de "3 por semana" no aparezca siempre
por debajo del 50% aunque se cumpla siempre.

## Tareas: lista por día, agrupada por texto libre, sin IA todavía

`usuarios/{uid}/tareas/{tareaId}` — mismo patrón dual que hábitos y eventos
(`tareasRepository.js`). Cada tarea pertenece a un día concreto (`fecha`,
'YYYY-MM-DD'): es una lista de "hoy quiero hacer esto", no una lista maestra
que arrastra sola lo no hecho de un día a otro — si no se termina, se queda
sin marcar en el historial de ese día, y ya está. `grupo` es un texto libre
opcional (p. ej. "Actividades") sin más significado que agrupar visualmente
varias tareas sueltas; el agrupado es cosa del cliente (`Tareas.jsx`), no de
la consulta a Firestore.

A diferencia de hábitos y eventos, esto **no está enganchado al asistente
todavía** — ni herramienta en `_herramientas.js` ni mención en `_prompt.js`.
Es alta y edición a mano, sin chat de por medio. Si se pide integrarlo,
seguiría el mismo patrón que `crear_evento`/`editar_evento`.

El pomodoro (`usePomodoro.js`) vive en memoria del navegador, montado en
`App.jsx` para sobrevivir a cambiar de pantalla — nada en Firestore, nada de
QStash: es una cuenta atrás de 25 minutos que solo importa mientras tienes la
app abierta, no algo que deba sonar si te vas. Guarda el instante en que
acaba (`finEn`), no un contador que reste segundo a segundo, para no
desincronizarse si el navegador frena el timer con la pestaña en segundo
plano. El aviso es un pitido generado con Web Audio (sin fichero de sonido en
el repo) más una `Notification` del navegador si hay permiso — igual que
hábitos y eventos, pide permiso de notificaciones la primera vez que se usa.

## Diseño

Maquetas fuente en `design/*.dc.html`, editables con la skill `design`.
Lienzo publicado: https://claude.ai/code/artifact/9af90c41-b1d9-4543-8532-67a8ec2d2e79
No edites `design/ia-calendar.html` a mano — se regenera desde los `.dc.html`
con `seed-canvas.mjs` (ver `design/_gen-*.mjs` como referencia de cómo se
generó el contenido dinámico de esos artboards).
