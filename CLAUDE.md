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

**Primer plano vs segundo plano, y por qué el dispositivo "activo" podía
parecer mudo.** Firebase Messaging entrega un push de dos formas distintas
según el estado de la pestaña: en segundo plano (o con la app cerrada) lo
recoge `public/firebase-messaging-sw.js` (`onBackgroundMessage`); con la
pestaña en primer plano, el SDK lo manda al cliente por `onMessage()` — y
durante un tiempo nada escuchaba eso, así que esos avisos se perdían en
silencio. El dispositivo desde el que sueles arrancar algo (el que tienes
delante, con la pestaña abierta y enfocada) es justo el que caía en ese
hueco. `useNotificaciones.js` ahora también escucha `onMessage()` y muestra
la notificación a mano (`new Notification(...)`) + un pitido
(`src/lib/sonido.js`) — el mismo camino que ya usa el pomodoro local. Esto
arregla el hueco para cualquier push (hábitos, eventos, pomodoro), no solo
uno.

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

## Eventos de varios días: el dato ya existía, faltaba la banda

Un evento con `fin` en un día posterior al de `inicio` (el viaje que ocupa
28-30, al estilo del Calendario de iPhone) siempre fue válido en el esquema —
`crearSerieRecurrente` ya lo maneja con `desplazamientoFin` — pero
`ModalEvento.jsx` solo dejaba picar la hora de fin, nunca un día distinto, y
la vista de mes los pintaba como una píldora repetida por celda.

- `ModalEvento.jsx`: casilla "Dura varios días" que revela un campo "Hasta"
  (fecha). Construye `fin` con ese día en vez de forzar el de `inicio`.
- `useEventos.js::porDia`: un evento así se apunta en el índice de **cada**
  día que ocupa, no solo el primero — así la agenda de un día suelto y la
  vista semana lo encuentran sin tocar nada más en esos componentes.
- `VistaMes.jsx` + `src/lib/bandas.js` (nuevo, puro): saca esos eventos de
  `porDia` una sola vez por id (para no repetir la píldora en cada celda) y
  los pinta como banda que atraviesa las columnas, cortándose y volviendo a
  redondear en cada salto de semana de la rejilla de 42 celdas. Cada celda
  reserva un hueco (`carrilesPorFila`) del alto de las bandas de su fila antes
  de las píldoras normales, para que no se solapen.
- El mes del móvil (`compacto`) se queda con el mapa de puntos de siempre, sin
  banda — el punto ya avisa que ese día tiene algo, y entrando a la agenda del
  día se ve el evento completo gracias al cambio en `porDia`.
- **Límite conocido, no arreglado:** `suscribirEventos`/`leerEventos` filtran
  por `inicio` dentro del rango pedido. Un evento que empieza *antes* del mes
  visible pero sigue dentro de él (ej. viaje que arranca el 30 de julio y
  sigue el 1 de agosto, visto solo en agosto) no aparecería. Encaja porque la
  rejilla de mes siempre se pide entera (42 días) y casi ningún viaje empieza
  fuera de la vista actual — pero si algún día molesta de verdad, la consulta
  necesitaría comprobar solapamiento (`fin >= desde`) además de `inicio`, no
  solo acotar por `inicio`.

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
recordatorio diario a hora exacta por hábito, avisos sueltos "X antes" por
evento (con nota opcional), tareas del día con color de categoría, un
pomodoro configurable que avisa por push real con la app cerrada, y
recordatorios sueltos puntuales o semanales ("recuérdame que...", pestaña
propia y enganchados al asistente) — los cinco últimos vía Upstash QStash,
código completo, pendiente de que el usuario cree la cuenta gratuita (ver
README). Viewport móvil fijado (sin zoom, sin que el teclado deforme el
layout).

Sin construir: canal externo (WhatsApp/Telegram — decidido: Telegram primero,
reutilizando `api/_cerebro.js::pensar()`), y avisos en eventos repetidos
(una serie no lleva "avísame antes" — multiplicaría los mensajes de QStash
por cada ocurrencia). Detalle de cada uno en «Próximos pasos» del README.

## QStash: quién dispara los avisos de hábito, evento y pomodoro, y por qué no es Vercel Cron

Los avisos de fase 4 (diario, semanal) usan Vercel Cron porque son "una vez al
día, hora fija de todo el proyecto" — encaja perfecto. Un aviso de hábito a
*su propia* hora no encaja: Vercel Hobby no permite más de un disparo diario
por cron y la hora es la misma para cualquier cron que definas en
`vercel.json`, no algo que puedas variar por usuario u objeto en tiempo de
ejecución. Upstash QStash sí: sus *schedules* se crean y borran por código.

**Los cinco "QStash llama de vuelta aquí" son UN solo fichero, no cinco.**
`api/qstash/[tipo].js` es una ruta dinámica de Vercel: la URL de cada aviso
sigue siendo la de siempre (`/api/qstash/recordatorio`,
`/api/qstash/recordatorioEvento`, `/api/qstash/recordatorioPomodoro`,
`/api/qstash/recordatorioSemanal`, `/api/qstash/recordatorioUnico` — nadie que
programa un aviso tiene que cambiar nada), pero las cinco caen en la misma
función y `req.query.tipo` dice cuál tocaba. No es una preferencia de estilo:
el plan Hobby de Vercel limita a 12 Serverless Functions por despliegue, y
tenerlos sueltos (más las rutas de alta, más chat/salud/crons) lo superaba —
el build empezó a fallar en seco con "No more than 12 Serverless Functions"
al añadir los recordatorios. Si se añade un sexto tipo de aviso en el futuro,
va como una función más dentro de `AVISOS` en ese mismo fichero, no como un
fichero nuevo — cada fichero nuevo bajo `api/` (sin `_`) cuenta para el
límite, aunque sea diminuto.

**Bug real que esa fusión introdujo (encontrado y arreglado el 24/08/2026):
ningún aviso de los cinco tipos llegaba a mandar nada.** La verificación de
firma reconstruía la URL con `req.url` tal cual — pero en una ruta dinámica,
Vercel cuela el propio segmento (`tipo`) como query param además de
resolverlo en el path, así que `req.url` traía `...&tipo=recordatorioSemanal`
de más. QStash firma la URL de *destino* que se programó (sin ese `tipo`), así
que `Receiver.verify()` comparaba dos URLs distintas y rechazaba la firma
siempre — 401 en silencio, reintentado por QStash unas pocas veces y
descartado. Nadie lo notó hasta que faltó un aviso semanal concreto: los
avisos de hábito/evento/pomodoro llevaban el mismo fallo desde el mismo
despliegue, solo que menos visible porque hay menos avisos de esos por
semana. Arreglado con `urlFirmada()` en `api/qstash/[tipo].js`, que
reconstruye la URL a mano quitando `tipo` de la query en vez de fiarse de
`req.url`. **Lección para el futuro:** en cualquier ruta dinámica de Vercel
que verifique una firma sobre su propia URL, `req.url` no es la URL que firmó
quien la llamó — hay que reconstruirla sin el segmento dinámico.

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
- `api/qstash/[tipo].js` (con `tipo=recordatorio`) — la llama QStash a la hora
  programada. Verifica la firma con `Receiver` de `@upstash/qstash` (nunca te
  fíes de una petición que dice venir de QStash sin comprobarlo) y relee el
  hábito en Firestore antes de mandar el push, en vez de guardar su nombre en
  el propio *schedule* — así si le cambias el nombre después de programar el
  aviso, llega el nombre nuevo.

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
`api/qstash/[tipo].js` con `tipo=recordatorioEvento` es a donde QStash llama
de vuelta), más una nueva por el límite de 7 días:

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

### Pomodoro: ni *schedule* ni un solo mensaje — y no encadena solo, a propósito

Un hábito repite siempre a la misma hora (*schedule*) y un evento avisa una
vez (mensaje suelto), pero un pomodoro es una secuencia de fases de
duración variable (trabajo, descanso, trabajo...) que además se puede parar
a media sesión — ninguno de los dos mecanismos anteriores encaja tal cual.

Al acabar una fase, `api/qstash/[tipo].js` (con `tipo=recordatorioPomodoro`) manda el aviso y
deja el pomodoro **esperando** (`esperando: true`, `finEn: null`,
`qstashId: null`) — no programa la siguiente fase por su cuenta. Hace falta
que alguien pulse "Seguir" en la app (`api/pomodoro/continuar.js`) para que
arranque de verdad la cuenta atrás del descanso o de la siguiente ronda.
Es a propósito: un descanso que salta solo mientras sigues a medias de algo
es peor que uno que espera. El estado de verdad vive en
`usuarios/{uid}/pomodoro/actual` (fase, ronda, `esperando`, `finEn`,
`qstashId` del próximo aviso si lo hay) — el navegador solo lo escucha con
`onSnapshot` para pintar la cuenta atrás o el botón de "Seguir", nunca
decide él solo qué toca.

`finEn` viaja en la URL del mensaje a propósito: al llegar la llamada, se
compara con el `finEn` que hay ahora mismo en Firestore. Si no coincide, es
que se paró o se reprogramó el pomodoro desde la app mientras el mensaje
viejo seguía en la cola de QStash — se descarta sin mandar nada, en vez de
avisar de una fase que ya no existe.

`api/pomodoro/parar.js` cancela el `qstashId` pendiente con
`client.messages.cancel()` antes de marcar `activo: false` — sin eso, el
aviso ya programado llegaría igual aunque hubieras parado el reloj en la app.

Sin Firebase configurado (modo local), nada de esto existe: `usePomodoro.js`
elige entre `usePomodoroRemoto` (Firestore + QStash) y `usePomodoroLocal`
(el timer de navegador de siempre, solo mientras la pestaña esté abierta)
mirando la constante `hayFirebase` — fija al cargar la app, así que no
rompe las reglas de los hooks aunque parezca una condición.

### Evitar avisos duplicados: `reclamarAviso()`, no "leer y luego escribir"

Los tres avisos por QStash (hábito, evento, pomodoro) comparten el mismo
riesgo: QStash puede invocar la función más de una vez casi a la vez —no
necesariamente un reintento tardío, puede ser prácticamente simultáneo—, y
si el candado es "leer un campo, comprobar si ya se avisó, y si no escribir
que sí", dos invocaciones pueden leer "no enviado" antes de que ninguna
llegue a escribir. Eso pasó de verdad con los hábitos y se veía como avisos
duplicados en el móvil y el ordenador a la vez.

El arreglo es `reclamarAviso()` en `api/_avisos.js`: crea un documento
centinela con `.create()` de Firestore Admin, que **falla si el documento ya
existe** (`ALREADY_EXISTS`). Eso sí es atómico — de dos invocaciones
concurrentes, Firestore solo deja que una gane la creación, la otra recibe
el error y no manda nada. La clave del centinela cambia según el caso (la
fecha para hábitos, el `messageId`/`finEn` para eventos y pomodoro, algo que
identifique de forma única *este* disparo, no el hábito/evento en general) y
vive en una subcolección `avisos` colgando del propio documento.

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
la consulta a Firestore. `categoria` es opcional, una de las cuatro de
`config/categorias.js` — solo para el punto de color, no cambia nada más.

**Lección cara aprendida aquí**: `suscribirTareas()` NO lleva `orderBy` en la
consulta a Firestore, aunque `eventosRepository.js` y `habitosRepository.js`
sí ordenan sus consultas. La diferencia importa: `where('fecha','==',fecha)`
(igualdad) + `orderBy('creadoEn')` (campo distinto) es exactamente el patrón
que Firestore obliga a tener un índice compuesto — sin él, `onSnapshot` no
entrega nada nuevo y la tarea recién creada solo aparecía al volver a
suscribirse (cambiar de día y volver). `eventosDelUsuario` y el `orderBy`
de hábitos evitan esto porque ordenan por el MISMO campo del filtro, o no
filtran nada. Si algún día hace falta ordenar una consulta con filtro de
igualdad, ordena en el cliente (como aquí) en vez de añadir el índice —
menos que mantener y nada que romperse si Firestore cambia de opinión.

A diferencia de hábitos y eventos, esto **no está enganchado al asistente
todavía** — ni herramienta en `_herramientas.js` ni mención en `_prompt.js`.
Es alta y edición a mano, sin chat de por medio. Si se pide integrarlo,
seguiría el mismo patrón que `crear_evento`/`editar_evento`.

El pomodoro (`usePomodoro.js`) es independiente de las tareas a propósito —
no arranca "desde" una tarea concreta, es un reloj configurable aparte
(minutos de trabajo, minutos de descanso, número de rondas) que se enseña en
`PomodoroPanel.jsx`. Con Firebase configurado vive en el servidor (Firestore
+ QStash encadenado, ver «Pomodoro: ni *schedule* ni un solo mensaje» más
abajo) para seguir avisando con la app cerrada; el navegador solo escucha el
estado con `onSnapshot` para pintar la cuenta atrás. Sin Firebase (modo
local) cae a un timer de navegador de toda la vida, que guarda el instante
en que acaba la fase (`finEn`) en vez de un contador que reste segundo a
segundo, para no desincronizarse si el navegador frena el timer en segundo
plano — pero ahí sí deja de avisar en cuanto cierras la pestaña, es la
limitación real de no tener servidor detrás. El aviso, en los dos casos, es
un pitido generado con Web Audio (sin fichero de sonido en el repo) más una
`Notification` del navegador si hay permiso.

`PomodoroFlotante.jsx` es la píldora que se ve desde cualquier pantalla
mientras corre — se oculta a propósito en la propia pantalla de Tareas
(`oculto` prop) porque ahí ya está `PomodoroPanel` a la vista, y verlo dos
veces sería ruido.

## Recordatorios: avisos sueltos, no eventos del calendario

`usuarios/{uid}/recordatorios/{recordatorioId}` — mismo patrón dual que
hábitos, tareas y eventos (`recordatoriosRepository.js`). La diferencia con un
evento es de propósito: "recuérdame sacar la basura" no tiene sentido como
algo que aparezca en el mes o la semana, es solo un empujón a una hora. Por
eso viven en su propia pestaña (`Recordatorios.jsx`), no en el calendario.

Dos tipos, sin documento plantilla compartido — cada uno reutiliza tal cual
uno de los dos mecanismos de QStash que ya existían, en vez de inventar uno
nuevo:

- **`unico`** — `fecha` + `hora`. Igual que el aviso "X antes" de un evento:
  un mensaje suelto de QStash, con el límite de 7 días del plan gratuito
  (`api/cron/encolarRecordatorios.js`, ya compartido con eventos, recoge los
  que se crean más lejos). Al sonar se marca `hecho: true` — **no se borra
  solo**: el usuario decide cuándo quitarlo de la lista, como una tarea.
- **`semanal`** — `dias` (lunes=0...domingo=6, la convención de
  `indiceSemana()`) + `hora`. Igual que el aviso diario de un hábito: un
  único *schedule* recurrente de QStash por recordatorio (no uno por día),
  con la lista de días ya en el propio cron
  (`CRON_TZ=Europe/Madrid m h * * d1,d2,...`). Sigue sonando cada semana
  hasta que se borra a mano.

`diaCron()` en `api/_qstash.js` traduce la convención de la app (lunes=0) al
día de semana que espera cron (domingo=0): `(diaApp + 1) % 7`. Si se te
olvida esta conversión, el aviso suena el día de al lado.

`api/recordatorios/programar.js` hace las dos cosas de golpe (a diferencia de
hábitos y eventos, que tienen un endpoint cada uno): antes de decidir qué
programar, siempre intenta borrar el *schedule* semanal (por id determinista,
`idScheduleRecordatorio()`) y cancelar el mensaje único anterior si lo había
— así cambiar de tipo (de "cada lunes" a "solo mañana", o al revés) no deja
un aviso huérfano sonando por su cuenta.

El cron diario que recoge los recordatorios únicos lejanos usa
`.where('fecha', '>=', hoy).where('fecha', '<=', hasta)` — rango en un único
campo, sin filtrar por `tipo` en la consulta (eso exigiría un índice
compuesto, ver la lección de tareas más arriba). Funciona solo porque los
recordatorios semanales guardan `fecha: null`, y Firestore excluye los
documentos con ese campo a `null` de cualquier filtro de rango — quedan fuera
sin que el código tenga que descartarlos a mano.

Como tareas, **tampoco tenía tool en el asistente hasta ahora**: a diferencia
de tareas, aquí sí se enganchó desde el principio
(`crear_recordatorio`/`consultar_recordatorios`/`borrar_recordatorio` en
`_herramientas.js`, sección propia en `_prompt.js`) porque "recuérdame que…"
es lenguaje tan natural que dejarlo solo para alta a mano habría sido dejar
la mitad del valor sobre la mesa. El prompt decide entre crear_recordatorio y
crear_evento por una sola pregunta: ¿tiene sentido esto en el calendario
(cita, clase, turno) o es solo un aviso suelto? Si dudas al leer el prompt,
esa es la pregunta que había que resolver.

## Diseño

Maquetas fuente en `design/*.dc.html`, editables con la skill `design`.
Lienzo publicado: https://claude.ai/code/artifact/9af90c41-b1d9-4543-8532-67a8ec2d2e79
No edites `design/ia-calendar.html` a mano — se regenera desde los `.dc.html`
con `seed-canvas.mjs` (ver `design/_gen-*.mjs` como referencia de cómo se
generó el contenido dinámico de esos artboards).
