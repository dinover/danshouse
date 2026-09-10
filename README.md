# Dan's House

La carta de la casa. Sólo lista lo que **realmente se puede hacer** con los ingredientes
que hay ahora mismo: si aparece en el menú, hay con qué prepararlo.

- **`/`** — la carta, para las visitas. Sin login.
- **`/admin`** — la cocina: marcar qué hay en casa, armar la lista de compras, ver qué conviene comprar y cargar recetas. Con contraseña.

En Compras podés generar una **lista de compras**: parte de todo lo que falta en
casa, sacás lo que no vas a comprar y sale como texto plano agrupado por
categoría, listo para copiar o mandar por WhatsApp.

## Cómo decide qué mostrar

Cada receta declara los ingredientes que necesita. Un requisito puede ser un ingrediente
suelto o una lista de alternativas:

```js
need: ['huevos', ['manteca', 'aceite'], 'sal']   // huevos + (manteca O aceite) + sal
opt:  ['crema', 'pan']                            // suman si están, nunca bloquean
```

Un plato entra en la carta cuando **todos** sus requisitos están cubiertos. Los que quedan
a uno o dos ingredientes aparecen bajo *"a un paso"*, con lo que falta, si se activa el filtro.

Los ingredientes marcados como `staple` (sal, aceite, azúcar, agua, hielo, pimienta) se
asumen presentes la primera vez, y no se anuncian en la descripción de cada plato.

## Puesta en marcha

El dominio `leinonair.com` ya está en Vercel, así que el subdominio sale de ahí.

**1 · Crear el proyecto**

En Vercel → *Add New Project* → importar `dinover/danshouse`. No hace falta configurar build:
es HTML estático más funciones en `api/`.

**2 · Conectar el subdominio**

Project → Settings → Domains → agregar `danhouse.leinonair.com`. Vercel indica el registro DNS
a crear (un CNAME hacia `cname.vercel-dns.com`); si el DNS de `leinonair.com` ya lo maneja
Vercel, lo agrega solo.

**3 · La contraseña del panel**

Settings → Environment Variables:

| Variable | Valor | Para qué |
|---|---|---|
| `ADMIN_PASSWORD` | la que elijas | Entrar a `/admin`. **Sin esto el panel remoto no funciona.** |
| `ADMIN_SECRET` | cualquier cadena larga al azar | Opcional. Firma la sesión; si no está, se deriva de la contraseña. Definirla permite cambiar la contraseña sin cerrar la sesión. |

**4 · La base de datos**

En Vercel, dentro del proyecto → pestaña **Storage** → **Create Database** →
elegir **Upstash** (*Serverless DB · Redis*). Es una base chiquita que Vercel
ofrece en su propio menú; el plan gratis alcanza de sobra para esto.

Al crearla te pregunta:

- **Región**: la más cercana, para que responda rápido.
- **Plan**: *Free*.
- **Conectar al proyecto**: marcá `danshouse`, en los tres entornos
  (Production, Preview, Development).

Con eso Vercel carga las variables solo. Para confirmar, mirá en
Settings → Environment Variables que estén estas dos:

| Variable | Qué es |
|---|---|
| `KV_REST_API_URL` | la dirección de la base |
| `KV_REST_API_TOKEN` | la clave de acceso |

Si la integración las nombró distinto, el código también acepta
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`. Lo que **no** sirve es
`KV_URL` ni `REDIS_URL` a secas: esas son para conectarse por protocolo Redis,
y las funciones hablan por HTTP.

Sin este paso el sitio igual funciona, pero en **modo local**: los cambios del panel quedan
guardados sólo en el navegador de quien los hizo y las visitas no los ven. El panel lo avisa
con un cartel.

Después de agregar variables hay que **volver a desplegar** para que tomen efecto.

## Seguridad del panel

- La contraseña vive sólo como variable de entorno en el servidor; nunca viaja al navegador.
- La sesión es una cookie `HttpOnly`, `Secure`, `SameSite=Lax`, firmada con HMAC-SHA256 y con
  vencimiento a 30 días. Una cookie alterada o vencida no vale.
- Las comparaciones de contraseña y firma son de tiempo constante.
- Ocho intentos fallidos por IP cada quince minutos y listo.
- Todo lo que llega del panel se valida en el servidor antes de guardarse: ids desconocidos,
  secciones inventadas o etiquetas fuera de la lista se descartan.

## Desarrollo local

```bash
npm run validar                          # revisa que las recetas no citen ingredientes inexistentes
ADMIN_PASSWORD=loquesea \
KV_REST_API_URL=http://localhost:3001 \
KV_REST_API_TOKEN=cualquiera \
  npm run dev                            # sitio + base de mentira en http://localhost:3000
```

Sin las variables de entorno el servidor local arranca igual, en modo local.

## Mapa del repo

```
index.html              la carta
admin.html              el panel
assets/
  styles.css            todo el diseño
  engine.js             qué se puede hacer y qué conviene comprar
  api.js                lectura y escritura del estado (con respaldo local)
api/
  state.js              GET público · PUT del admin
  session.js            login, logout y estado de sesión
  _lib/
    ingredients.js      catálogo de ingredientes
    recipes.js          recetario
    state.js            mezcla la base del repo con lo cargado desde el panel
    store.js            la base (Redis REST)
    auth.js             contraseña, cookie firmada, freno de intentos
scripts/                validación y servidor de desarrollo
```

Las recetas e ingredientes del repo son la base. Lo que se agrega desde el panel se guarda
aparte y se superpone, así que actualizar este repo no pisa lo cargado a mano.
