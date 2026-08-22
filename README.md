# IA Calendar

Calendario personal donde la IA es la interfaz: cuentas lo que pasa (hablando o
escribiendo) y ella lo estructura, lo coloca y te avisa. Cuatro categorías —
Universidad, Trabajo, Salud y Random — más hábitos y avisos proactivos.

## Cómo arrancarlo

```bash
npm run setup                      # instala la app y el servidor
cp server/.env.example server/.env # y pega dentro tu clave de Anthropic
npm run dev:all                    # http://localhost:5180
```

`npm run dev` a secas levanta solo el calendario, sin asistente.

### Conectar Firebase

Sin esto la app funciona, pero guarda en el navegador: el Mac y el móvil tienen
agendas distintas y se pierde todo si limpias los datos del navegador.

1. En [console.firebase.google.com](https://console.firebase.google.com), **Crear
   proyecto**. Nombre `iacalendar`. Google Analytics puedes desactivarlo.
2. **Compilación > Firestore Database > Crear base de datos**. Modo producción.
   Región `eur3 (europe-west)`, que es la más cercana.
3. **Compilación > Authentication > Comenzar > Google > Habilitar**. Pon tu
   correo como correo de asistencia y guarda.
4. Rueda dentada arriba a la izquierda > **Configuración del proyecto**. Baja
   hasta **Tus apps** y pulsa el icono web `</>`. Apodo `web`, registrar.
5. Copia los valores de `firebaseConfig` a `.env.local` (parte de
   `.env.example`). Cada campo tiene el mismo nombre en mayúsculas.
6. Publica las reglas. **Esto no es opcional**: las de fábrica del modo
   producción bloquean a todo el mundo, tú incluido, y la app no podrá guardar
   nada. Dos formas:

   ```bash
   npm run reglas    # pide entrar con Google la primera vez
   ```

   O a mano: pega el contenido de `firestore.rules` en la consola, en
   **Firestore Database > Reglas**, y dale a Publicar.

Al entrar por primera vez, lo que tuvieras guardado en ese navegador sube solo a
tu cuenta. No se borra de local: si algo fallara, sigue ahí. Los eventos de
muestra que siembra la app en modo local se quedan fuera — van marcados para
eso, así tu agenda de verdad no arranca con cosas inventadas.

Si al entrar sale una banda avisando de que Firestore rechaza el acceso, es que
el paso 6 quedó a medias: las reglas de fábrica del modo producción bloquean a
todo el mundo, tú incluido.

Para usarlo desde el móvil por wifi hay que añadir la IP del Mac en
**Authentication > Settings > Dominios autorizados**, o Google rechaza la
entrada desde esa dirección.

### Verlo en el móvil

```bash
npm run dev:movil
```

Levanta lo mismo pero escuchando en la red local. Desde el móvil, con el
teléfono en el mismo wifi que el Mac, entra en `http://<ip-del-mac>:5180`
(la propia consola de Vite imprime la dirección al arrancar).

El servidor del asistente no hace falta exponerlo: el proxy de Vite le llama
desde el Mac, así que el móvil solo necesita alcanzar el 5180.

Sin configurar nada funciona: guarda los eventos en el navegador
(localStorage) y siembra unos cuantos de muestra para que no aparezca vacío.

Para conectar la base de datos real, copia `.env.example` a `.env.local` y
rellénalo con los datos de tu proyecto de Firebase (Consola > Configuración del
proyecto > Tus apps > Configuración del SDK). En cuanto haya credenciales, el
repositorio cambia a Firestore solo, sin tocar código, y el calendario pasa a
actualizarse en vivo.

## Atajos de teclado

| Tecla | Qué hace |
|---|---|
| `←` `→` | Mes o semana anterior / siguiente |
| `T` | Volver a hoy |
| `N` | Nuevo evento |
| `Esc` | Cerrar el diálogo |

Doble clic en un día del mes también abre el alta con esa fecha puesta.

## Sesión y datos

Cada agenda cuelga de su dueño: `usuarios/{uid}/eventos`. Frente a una colección
plana con un campo `uid`, esto gana por dos lados — la regla de seguridad es una
comparación de la ruta contra el uid de la sesión, y las consultas por fecha no
necesitan índice compuesto porque ya van dentro de la colección del usuario.

Se entra con Google y punto: no hay registro, ni contraseñas, ni verificación
por correo. Es una agenda personal, no un producto con usuarios.

Sin credenciales de Firebase la app sigue arrancando en modo local, sin login.
Sirve para trastear sin montar nada.

## Desplegar en Vercel

El asistente vive en dos sitios que comparten el mismo código:

- **En producción**, `api/chat.js` es una función de Vercel. Los ficheros de
  `api/` que empiezan por `_` no son rutas, son la lógica compartida.
- **En local**, `server/` es un Express que llama exactamente a lo mismo. Existe
  para poder trabajar sin desplegar; no se sube a producción.

Al importar el repo, Vercel detecta Vite solo. Lo único que hay que darle son
las variables de entorno (Settings > Environment Variables):

| Variable | De dónde sale |
|---|---|
| `ANTHROPIC_API_KEY` | tu clave de Anthropic |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5` |
| `VITE_FIREBASE_API_KEY` y las otras cinco | tu `.env.local` |

### Comprobar que la configuración es correcta

Abre `https://<tu-app>.vercel.app/api/salud?probar=1`. Dice si la clave está,
si tiene la pinta correcta y si Anthropic la acepta — sin enseñar su valor.
Devuelve `todoBien: true` cuando está todo en orden, y una pista concreta
cuando no: que falta, que no empieza por `sk-ant-`, o que Anthropic la rechaza
por revocada.

Los espacios y saltos de línea al pegar la clave no rompen nada: el servidor la
limpia antes de usarla. Es un fallo facilísimo de cometer en un panel de
variables y en pantalla se ve idéntica a una buena, así que no merecía la pena
que costara un rato de búsqueda.

Las `VITE_` no salen ahí y no es un olvido: se incrustan al compilar y la
función no llega a verlas. Para esas, mira la app:

| Lo que ves al abrirla | Qué significa |
|---|---|
| «Entrar con Google» | Las seis están bien |
| El calendario y «Guardando en este navegador» | Falta alguna, o no has redesplegado |

Recuerda que tocar una variable `VITE_` obliga a **volver a desplegar**: se
incrustan al compilar, no se leen al ejecutarse.

El mismo `/api/salud?probar=1` también diagnostica los avisos push, bajo
`avisosPush` — la cuenta de servicio y `CRON_SECRET`. Es opcional: si no vas a
usar la fase 4 todavía, ese bloque en `FALTA` no afecta al resto de la app.
Detalle completo de qué poner y de dónde sacarlo en «Próximos pasos» más abajo.

Después, en Firebase > Authentication > Settings > **Dominios autorizados**,
añade el dominio que te dé Vercel. Sin eso la entrada con Google falla, que es
exactamente el error que sale al abrirlo desde el móvil por wifi.

## Móvil

Por debajo de 768px la app cambia de maquetación entera, no solo de tamaños:

- **Agenda del día** en vez del mes. En una pantalla de teléfono un mes son
  celdas de 50px donde no cabe nada legible; lo que necesitas mirar sobre la
  marcha es qué te queda hoy.
- **El micro, grande y centrado abajo**, donde llega el pulgar: es la acción
  principal de toda la app.
- **El mes queda como mapa**: número y puntos de color por categoría, y tocando
  un día se va a su agenda.
- El asistente se abre a pantalla completa.

Todos los blancos táctiles son de 44px o más. En escritorio no cambia nada.

## Cómo está montado

```
src/
  config/
    categorias.js    Las 4 categorías y sus colores en claro y oscuro
    firebase.js      Arranque; si no hay credenciales, se queda en null
  lib/
    fechas.js        Todo lo de fechas: semana en lunes, formato español
    recurrencia.js   Genera las fechas de una serie repetida
    resumen.js       Texto de los avisos push, plano — sin JSX
  services/
    eventosRepository.js   Firestore o localStorage tras la misma puerta
    ia.js            El bucle de agente: ejecuta las herramientas de Claude
    auth.js          Entrar y salir con Google
  hooks/
    useTema.js           Claro / oscuro / seguir al sistema
    useEventos.js        Suscripción en vivo a un rango + índice por día
    useNotificaciones.js Permiso, token y alta del dispositivo para avisos
  components/        Rail, cabecera, vista de mes/semana/día, chat, alta
  screens/
    LoginScreen.jsx  La puerta: entrar con Google y nada más

api/                  El cerebro y los avisos, en producción (funciones de Vercel)
  chat.js            POST /api/chat — sin estado, un turno por llamada
  salud.js           Diagnóstico de toda la configuración, sin exponer secretos
  _cerebro.js         Piensa: llama a Claude con las herramientas
  _herramientas.js    Las herramientas que Claude puede usar
  _prompt.js          Quién es, cómo trabaja y cómo escribe
  _modelo.js           Traduce el modelo elegido a sus parámetros
  _admin.js            Acceso de administrador a Firebase (cuenta de servicio)
  _avisos.js            Manda un push a todos los dispositivos de un usuario
  cron/
    diario.js          El aviso de las 9: qué tienes hoy
    semanal.js         El briefing de los lunes: la semana entera
    _comun.js           Fecha de hoy en Madrid, y el candado de CRON_SECRET

server/               El cerebro, en local. Llama a api/_cerebro.js — no se
  src/index.js         duplica: existe solo para trabajar sin desplegar.

public/
  firebase-messaging-sw.js   El service worker: recibe el push, abre la app
  manifest.webmanifest        Lo que hace la app instalable
  iconos/                     Generados desde un único glifo de marca
```

### Decisiones que conviene no deshacer sin pensarlo

**Las fechas viajan como texto, no como `Date`.** Una fecha suelta es
`'YYYY-MM-DD'` y una con hora `'YYYY-MM-DDTHH:mm'`. Al ser ordenables
alfabéticamente, los rangos funcionan igual en Firestore que en memoria, y nos
ahorramos el infierno de zonas horarias: esta app necesita saber "el martes a
las diez" en la vida del usuario, no en UTC.

**El repositorio tiene dos implementaciones tras una sola puerta.** Nada del
resto del código sabe si detrás hay Firestore o el navegador. Cuando en la fase
2 la IA cree eventos, llamará a `guardarEvento()` igual que el formulario.

**El bucle de agente vive en el navegador, no en el servidor.** El servidor
tiene la clave de Anthropic y piensa; el navegador es quien puede tocar la
agenda, esté en Firestore o en localStorage. Así que cuando Claude pide una
herramienta, el servidor devuelve la petición tal cual y el navegador la
ejecuta y contesta. El servidor es deliberadamente sin estado: recibe la
conversación entera en cada llamada. Cuando esto pase a Cloud Functions, el
mismo código sirve sin tocar nada.

**La clave nunca baja al navegador.** Cualquiera puede leer el JavaScript de
una web; si la clave estuviera ahí, sería de todos. Por eso hay un servidor,
aunque para el resto no haría falta.

**La consulta pide exactamente el rango visible.** Cambiar de mes cambia la
suscripción. El panel lateral tiene la suya propia (hoy + 10 días) para poder
hablar de esta semana aunque estés mirando diciembre.

## Estado

- [x] **Fase 1** — Calendario, base de datos, alta y edición a mano
- [x] **Fase 2** — El cerebro: Claude con herramientas, chat de texto
- [x] **Fase 3** — Voz: hablarle y que conteste en voz alta
- [x] **Desplegado** — Vercel + Firebase, sesión con Google, móvil
- [x] **Eventos recurrentes** — diarios y semanales
- [x] **Fase 4** — Avisos push y briefing de los lunes (código listo; te
      quedan 3 pasos manuales en Firebase/Vercel — sección de abajo)
- [x] **Fase 5** — Hábitos: alta, racha, marcado diario y progreso del mes
- [ ] **Fase 6** — Canal externo (Telegram o WhatsApp)

## Próximos pasos

### Fase 4 — Avisos push: cómo activarlos

El código ya está todo escrito. Lo que falta son datos que solo tú puedes
sacar de las consolas de Firebase y Vercel — no son secretos que yo pueda
inventar ni adivinar.

**Qué hace, en resumidas cuentas:** cada día a las 9 (hora de Madrid), un aviso
con lo que tienes ese día. Los lunes a las 9, un briefing de la semana entera.

Los hábitos (fase 5, ya construida) **no** usan este mecanismo: un recordatorio
por hábito a su propia hora exacta no encaja en "una vez al día, hora fija"
que es todo lo que da un Vercel Cron del plan Hobby. Ver la sección de QStash
más abajo para el disparador que sí lo permite, gratis.

**Tres pasos, en este orden:**

1. **Clave VAPID** (para que el navegador pueda recibir avisos). Firebase
   Console → icono de rueda dentada → **Configuración del proyecto** →
   pestaña **Cloud Messaging** → baja hasta **Certificados push web** →
   **Generar par de claves**. Copia la clave que aparece y ponla en Vercel
   como `VITE_FIREBASE_VAPID_KEY`.

2. **Cuenta de servicio** (para que el servidor pueda mandar avisos). Firebase
   Console → **Configuración del proyecto** → pestaña **Cuentas de servicio**
   → **Generar nueva clave privada**. Se descarga un fichero `.json`. Ábrelo,
   copia **todo** su contenido tal cual, y pégalo en Vercel como
   `FIREBASE_SERVICE_ACCOUNT`. Esto no es un secreto pequeño: quien lo tenga
   puede actuar como administrador de tu proyecto de Firebase entero. No lo
   subas nunca a git ni lo compartas — solo va en las variables de entorno de
   Vercel.

3. **Contraseña del disparador** (para que nadie más pueda hacer sonar tus
   avisos). En Vercel, añade `CRON_SECRET` con cualquier texto aleatorio de
   16 caracteres o más — un generador de contraseñas vale. Vercel la manda
   sola en cada disparo programado; no hay que hacer nada más con ella.

Después de meter las tres, vuelve a desplegar y comprueba en
`https://<tu-app>.vercel.app/api/salud?probar=1` que `avisosPush` sale bien
(el mismo diagnóstico que ya usaste para la clave de Anthropic).

Por último, activa la campanita: entra en la app (en el móvil, instalada en
la pantalla de inicio — ver más abajo) y pulsa el icono de campana en la
barra lateral o en la cabecera. Sin este último clic tuyo, nadie tiene un
token guardado y no hay a quién mandarle nada.

**Una cosa que no tiene arreglo, y hay que saberla de antemano:** en el plan
**Hobby de Vercel, cada Cron solo puede dispararse una vez al día, y sin
minuto exacto** — Vercel dice literalmente que puede llegar en cualquier
momento dentro de la hora configurada (entre las 8:00 y las 8:59 UTC, en nuestro
caso). Sumado a que España cambia de hora dos veces al año y el disparo está
fijado en UTC, el aviso de "las 9" llegará en la práctica entre las 8:00 y las
10:00 según la época del año — más cerca de las 9 en verano, que es donde
prioricé el ajuste porque cubre más meses del año. Para minuto exacto todo el
año hace falta el plan Pro de Vercel; no lo he activado porque no lo has
pedido, pero es la única forma de tener precisión real.

**En iPhone, además, el aviso solo llega si la web está instalada en la
pantalla de inicio** (Safari → compartir → Añadir a pantalla de inicio, con
iOS 16.4 o más nuevo). Ya lo dejé preparado (`public/manifest.webmanifest`,
iconos, `apple-touch-icon`) — es Apple quien exige el paso de instalar, no
hay forma de saltárselo.

### Recordatorios a hora exacta: Upstash QStash

Vercel Cron (lo que usan los avisos de fase 4) solo dispara una vez al día a
una hora fija de todo el proyecto — no sirve para "avísame de este hábito a
las 22:00" ni para "avísame 2h antes de la cita", que son horas por
usuario/objeto, no un horario fijo del despliegue. **Upstash QStash** sí lo
permite y tiene tier gratuito (1.000 mensajes/día, hasta 10 *schedules*
recurrentes con precisión al minuto, y mensajes sueltos a hora exacta con
hasta 7 días de antelación). El código ya está escrito y en `main`; solo
faltan las cosas de la lista de abajo, que solo puedes hacer tú.

**Ya construido — hábitos** (aviso diario a una hora fija, vía *schedule*
recurrente):
1. `api/_qstash.js` — cliente y verificador de firma de QStash, mismo patrón
   perezoso que `firebaseAdmin()` en `_admin.js`.
2. `api/qstash/recordatorio.js` — a donde llama QStash a la hora exacta.
   Verifica la firma, relee el hábito en Firestore (por si cambió de nombre
   desde que se programó el aviso) y manda el push con la misma función de
   `api/_avisos.js` que ya usan los avisos de fase 4.
3. `api/habitos/recordatorio.js` — a donde llama el navegador cuando creas,
   editas o borras un hábito con aviso. Verifica tu sesión de Firebase (el uid
   nunca se fía de lo que mande el navegador) y da de alta o retira el
   *schedule* en QStash, con `CRON_TZ=Europe/Madrid` para que no haya que
   tocar nada en el cambio de hora dos veces al año.
4. En `ModalHabito.jsx`, la casilla "Avisarme cada día a esta hora" — se ve la
   campanita con la hora al lado del hábito en la tabla si está activada.

**Ya construido — eventos** (aviso suelto de una vez, "X antes"; también
disponible pidiéndoselo a la IA por chat: "avísame una hora antes", "avísame
el día antes y recuérdame llevar el pasaporte" — esto último va en el campo
Nota, se lee junto con el aviso):
5. `api/eventos/recordatorio.js` — a donde llama el navegador al crear, editar
   o borrar un evento con aviso. A diferencia del de hábitos, esto es un
   mensaje suelto (no un *schedule*), así que solo se puede programar si cae
   dentro de los 7 días del plan gratuito; si el evento está más lejos, se
   deja pendiente sin id.
6. `api/qstash/recordatorioEvento.js` — a donde llama QStash a la hora
   programada. Igual que el de hábitos: firma verificada, relee el evento
   fresco antes de mandar el push (con la nota si la hay).
7. `api/cron/encolarRecordatorios.js` — cron diario nuevo (añadido a
   `vercel.json`) que revisa qué eventos con aviso pendiente ya han entrado
   dentro de la ventana de 7 días y los programa de verdad. Así un aviso
   pedido con semanas de antelación no se pierde, solo tarda unos días en
   activarse.
8. En `ModalEvento.jsx`, los chips "Avisarme antes" (15 min / 1h / 2h / 1
   día) — solo con hora concreta y sin repetición; los eventos repetidos no
   llevan aviso todavía.

**Solo puedes hacerlo tú, fuera de este repo:**
1. Crear cuenta gratis en [upstash.com](https://upstash.com) → QStash → copiar
   `QSTASH_URL`, `QSTASH_TOKEN` y las dos claves de firma
   (`QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`) — la propia
   consola de Upstash trae un botón para copiar las cuatro de golpe.
   `QSTASH_URL` importa de verdad: las cuentas nuevas caen en una región
   concreta (por ejemplo `eu-central-1`) y el token solo vale contra el
   endpoint de esa región — sin esta variable, el cliente apunta al endpoint
   por defecto y el token da 401 aunque esté bien copiado.
2. Añadir esas cuatro, más `APP_URL` (la URL de producción de esta app, tipo
   `https://tu-app.vercel.app`, sin barra final — QStash necesita poder
   llamarla desde fuera), en las variables de entorno de Vercel. Igual que
   `CRON_SECRET`: solo en Vercel, nunca en el repo.
3. Volver a desplegar — **las variables no se aplican solas**: hasta que no
   haya un despliegue nuevo después de guardarlas, las funciones siguen
   viendo el entorno de antes. Después, `/api/salud?probar=1` dice si las
   cinco están bien puestas (dentro de `recordatoriosHabitos.qstash`).
4. Activar la casilla en un hábito con hora — el *schedule* se crea solo, no
   hay nada que configurar en la consola de Upstash.

**Nota de seguridad:** si en algún momento pegaste el token o las signing keys
en un sitio que no sea el propio panel de Vercel (un chat, una nota, un
mensaje), regenéralas después en la consola de Upstash y actualiza Vercel con
los valores nuevos — es la única forma de que dejen de existir fuera de donde
deben.

**Lo que queda fuera, a propósito:** avisos en eventos repetidos (una serie
diaria/semanal no lleva "avísame antes" por ahora — multiplicaría los mensajes
de QStash por cada ocurrencia, la mayoría fuera de la ventana de 7 días de
todos modos). También pendiente el bug de avisos duplicados de hábitos —
sección "Bugs conocidos" más abajo.

### Fase 6 — WhatsApp o Telegram

Decisión ya tomada en su momento y que sigue en pie: **Telegram primero.**
Gratis, sin verificación de negocio, notas de voz nativas, y puede escribirte
sin las restricciones de ventana de 24h que tiene WhatsApp Cloud API para
mensajes proactivos (el briefing del lunes necesita poder iniciar conversación
él solo).

El trabajo es una función más: `api/telegram.js` como webhook que recibe el
mensaje de Telegram, transcribe si es audio, y llama a la misma
`api/_cerebro.js::pensar()` que ya usa el chat — el cerebro no cambia, solo el
tubo de entrada. Si más adelante quieres WhatsApp de verdad: Cloud API de
Meta, con un número de teléfono que no sea tu WhatsApp personal (una SIM
prepago sirve) y plantillas preaprobadas para poder escribir tú primero.

### Bugs conocidos

- **El aviso de hábito llega duplicado.** Confirmado en pruebas: llega dos
  veces, casi a la vez, tanto en móvil como en ordenador. El candado
  `ultimoAvisoEnviado` en `api/qstash/recordatorio.js` no lo arregló porque es
  "leer y luego escribir", no atómico — si QStash invoca la función dos veces
  casi a la vez (no un reintento tardío, sino algo prácticamente simultáneo),
  las dos lecturas pasan el candado antes de que ninguna de las dos escrituras
  llegue a tiempo. El arreglo de verdad es un "claim" atómico: un documento
  centinela por día (p. ej. `usuarios/{uid}/habitos/{id}/avisos/{fecha}`)
  creado con `.create()` de Firestore Admin — ese método falla con
  `ALREADY_EXISTS` si el documento ya existe, así que solo una de las dos
  invocaciones concurrentes puede "ganar" y mandar el push. No es urgente (el
  usuario lo puede vivir con avisos duplicados por ahora); pendiente de hacer.

### Otras mejoras a valorar

- **Confirmación antes de borrar.** El prompt le pide a la IA que pregunte
  si hay duda, pero no hay red de seguridad en la interfaz si se equivoca.
- **Deshacer la última acción de la IA**, por si interpreta mal algo.
- **Buscar**: el icono ya está en el `Rail`, sin pantalla detrás.
- **Recordatorios configurables** (ahora mismo "vence pronto" es fijo a
  universidad y salud a 10 días vista).

## El asistente

Modelo por defecto `claude-haiku-4-5`, el más barato. Cuatro herramientas:
`consultar_agenda`, `crear_evento`, `editar_evento` y `borrar_evento`. El
prompt le pide que consulte antes de crear, para poder avisar de solapes y de
lo que tengas cerca esos días — que es la mitad de la gracia de esto.

Para cambiar de modelo, `ANTHROPIC_MODEL` en `server/.env`. **No es solo
cambiar el nombre**: cada familia acepta una configuración distinta de
razonamiento y mandarle a Haiku lo que espera Opus devuelve un error 400. Eso
lo resuelve `api/_modelo.js`, que traduce el modelo elegido a los
parámetros que ese modelo entiende. Probados: `claude-haiku-4-5`,
`claude-sonnet-5` y `claude-opus-5`.

Coste medido, en una conversación normal de dos o tres intercambios: unos 0,8
céntimos por interacción con Haiku. Con Opus serían unos 5. A diez
interacciones al día, la diferencia es de ~2,5 €/mes contra ~15 €/mes.

### La paleta clara es crema, no blanca

Nada de blanco puro en ninguna superficie. El fondo es `#efeae1` y las tarjetas
`#f7f4ee`: un 10% menos de luminancia que el blanco, suficiente para que no
canse la vista en una pantalla grande y sin llegar a verse sucio. El texto se
mantiene a 15:1 de contraste.

Los tintes de las cuatro categorías bajaron con el resto. Si se hubieran quedado
donde estaban, habrían pasado a ser los puntos más luminosos de la pantalla y
los eventos parecerían estar gritando.

Todo cuelga de las variables de `index.css`. El tema oscuro no cambió.

### La voz no cuesta nada

Las dos direcciones usan lo que ya trae el navegador, así que la fase de voz no
sube la factura ni un céntimo.

**Al hablar**, `useDictado.js` usa el reconocimiento del navegador. Se podría
grabar el audio y mandarlo a Whisper, pero esto es gratis, va en español de
fábrica y escribe mientras hablas, que se siente bastante mejor que esperar a
que suba un fichero. Va en Chrome, Edge y Safari, iPhone incluido. Firefox no lo
lleva: allí el micro se desactiva y queda el teclado, que funciona igual.

**Al contestar**, `useVoz.js` usa la voz del sistema. En Mac y en iPhone las
españolas son buenas. Se activa con el altavoz de la cabecera y la preferencia
se recuerda.

Dos detalles que costaron un rato:

- Lo que se lee en voz alta pasa antes por `sinMarcas()`. Si no, la IA te
  recitaría "corchete corchete universidad barra Práctica 1".
- Si paras de hablar antes de que el navegador dé por cerrada la última frase,
  esa frase se perdía. Ahora el dictado se queda también con lo provisional.

### Eventos recurrentes

Un evento que se repite no es un documento distinto: son N eventos normales
que comparten `serieId`. Sin plantilla aparte — cada ocurrencia es editable y
borrable una a una con las funciones de siempre; `serieId` solo sirve para
poder borrarlas todas de golpe con `borrarSerie()`. Tope de 180 días vista si
no se da fecha de fin (`src/lib/recurrencia.js`); pasado ese punto hay que
crearla otra vez — no se auto-extiende.

Se puede crear a mano (selector en `ModalEvento`) o pidiéndoselo a la IA
("todos los martes", "cada día"). **Con Haiku, esto tiene un límite real que
no tiene arreglo de código**: si no le das fecha de fin, tiende a preguntar
"¿hasta cuándo?" en vez de usar el valor por defecto, incluso insistiéndole
directamente — llegó a inventarse que no podía crear algo indefinido, que es
falso. Probado con Sonnet usando el mismo prompt exacto: lo crea a la primera
sin preguntar. Es una diferencia de modelo, no de diseño. Mitigación práctica:
si Haiku pregunta, dale una fecha de fin generosa ("hasta final de año") — con
fecha de fin explícita funciona perfecto siempre.

### Avisos push: cómo funciona por dentro

Sin plan Blaze de Firebase ni Cloud Functions — todo corre en las funciones de
Vercel que ya existían. Enviar un push por FCM (Firebase Cloud Messaging) solo
necesita llamar a su API con una cuenta de servicio; eso lo puede hacer
cualquier función de `api/`.

**Quién dispara qué.** Vercel Cron llama a `api/cron/diario.js` y
`api/cron/semanal.js` con la cabecera `Authorization: Bearer <CRON_SECRET>`
que añade solo — `api/cron/_comun.js::autorizado()` comprueba que coincide
con la variable de entorno antes de tocar nada. Sin `CRON_SECRET`, esas rutas
rechazan cualquier petición: son URLs públicas como cualquier otra de `api/`,
así que sin el candado cualquiera podría dispararlas.

**Un usuario, varios dispositivos.** El Mac y el iPhone son documentos
distintos en `usuarios/{uid}/dispositivos/{idLocal}` — `idLocal` es un id
aleatorio guardado en `localStorage` de cada navegador
(`useNotificaciones.js`), así que volver a activar el permiso no crea
duplicados. El servidor manda a todos los dispositivos del usuario en
paralelo, y si uno ya no existe (desinstalada, permiso revocado), borra su
token de paso al recibir el error de FCM correspondiente
(`api/_avisos.js`).

**Ni dos veces el mismo día.** Vercel avisa de que un Cron puede repetirse por
un fallo de red — nada grave en sí, pero mandar el mismo aviso dos veces sí lo
sería. Cada usuario guarda `ultimoDiarioEnviado`/`ultimoSemanalEnviado`
('YYYY-MM-DD') en su propio documento, y el cron se lo salta si ya coincide
con hoy.

**La hora es siempre la de Madrid**, calculada con
`Intl.DateTimeFormat(..., { timeZone: 'Europe/Madrid' })` — nunca con el reloj
del servidor, que en Vercel corre en UTC y en cualquier región del mundo.

**El icono es una plantilla HTML, no un archivo de diseño aparte.** Los cinco
tamaños de `public/iconos/` salen de una página mínima — una página de
calendario con dos anillas de espiral y una rejilla de colores, los mismos
que las categorías — capturada con Chromium sin cabeza y redimensionada con
`sips`. Si cambia la marca, se retoca ese HTML y se regeneran los cinco, no se
diseñan uno a uno.

**Safari en macOS ignora el icono que se manda en cada aviso.** Usa siempre
el del manifest, pase lo que se le pida en `showNotification()` — es un
límite conocido de su implementación, no un fallo de esta app. Por eso el
icono real es el del manifest (`public/manifest.webmanifest`), y el que se
pasa en `public/firebase-messaging-sw.js` es solo para Chrome/Edge, que sí lo
respetan; deben apuntar siempre al mismo fichero para que no se noten
distintos según el navegador.

### Los nombres de eventos van coloreados

Cuando la IA menciona un evento lo marca con su categoría —`[[salud|tratamiento]]`—
y `components/Markdown.jsx` lo pinta con el color de esa categoría y un subrayado
fino. Así el texto del chat deja de ser plano y se lee de un vistazo qué es cada
cosa.

Lo marca el modelo y no lo adivinamos comparando cadenas a propósito: él sabe
que "Práctica 1" es el evento titulado "Entrega Práctica 1", y nosotros solo
veríamos dos textos distintos. Si algún día se olvida de marcar o se inventa una
categoría, la frase se pinta en plano: peor, pero nunca rota. Y por si acaso, el
repositorio limpia las marcas de los títulos antes de guardarlos.

Lo que se paga con Haiku es fiabilidad: es peor calculando fechas. Por eso el
prompt no le pide que cuente días — recibe ya escrita la tabla de esta semana y
la siguiente, día por día, y solo tiene que consultarla.

## Diseño

Las maquetas fuente están en [`design/`](design/) y el lienzo publicado en
https://claude.ai/code/artifact/9af90c41-b1d9-4543-8532-67a8ec2d2e79
