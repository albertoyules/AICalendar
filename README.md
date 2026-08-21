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
  services/
    eventosRepository.js   Firestore o localStorage tras la misma puerta
  hooks/
    useTema.js       Claro / oscuro / seguir al sistema
    useEventos.js    Suscripción en vivo a un rango + índice por día
  services/
    ia.js            El bucle de agente: ejecuta las herramientas de Claude
  components/        Rail, cabecera, vista de mes, vista de semana, chat, alta

server/              El cerebro. Tiene la clave; no tiene la agenda.
  src/
    index.js         POST /api/chat — sin estado, un turno por llamada
    herramientas.js  Las 4 herramientas que Claude puede usar
    prompt.js        Quién es, cómo trabaja y cómo escribe
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
- [ ] **Fase 4** — Avisos push al escritorio y briefing de los lunes
- [ ] **Fase 5** — Hábitos y rachas
- [ ] **Fase 6** — Canal externo (Telegram o WhatsApp)

## El asistente

Modelo por defecto `claude-haiku-4-5`, el más barato. Cuatro herramientas:
`consultar_agenda`, `crear_evento`, `editar_evento` y `borrar_evento`. El
prompt le pide que consulte antes de crear, para poder avisar de solapes y de
lo que tengas cerca esos días — que es la mitad de la gracia de esto.

Para cambiar de modelo, `ANTHROPIC_MODEL` en `server/.env`. **No es solo
cambiar el nombre**: cada familia acepta una configuración distinta de
razonamiento y mandarle a Haiku lo que espera Opus devuelve un error 400. Eso
lo resuelve `server/src/modelo.js`, que traduce el modelo elegido a los
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

## Pendiente antes de usarlo de verdad

- **Cloud Functions necesita el plan Blaze** para poder llamar a la API de
  Claude. El plan gratuito Spark bloquea las llamadas salientes.

## Diseño

Las maquetas fuente están en [`design/`](design/) y el lienzo publicado en
https://claude.ai/code/artifact/9af90c41-b1d9-4543-8532-67a8ec2d2e79
