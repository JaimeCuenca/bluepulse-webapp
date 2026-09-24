# BluePulse — webapp

Frontend estático (HTML/CSS/JS vanilla + Chart.js por CDN) + Cloudflare Pages
Functions como API. Sin build step: se despliega tal cual.

## Estructura

```
public/            -> lo que se sirve tal cual (frontend)
  index.html
  css/style.css
  js/app.js
functions/
  _lib/github.js    -> helper para leer/escribir en el repo privado de datos
  api/
    login.js        -> POST -> valida contraseña, pone cookie de sesión
    wellness.js      -> GET  -> snapshots diarios de sueño/batería corporal/kcal
    garmin.js        -> GET  -> actividades sincronizadas de Garmin
    partidos.js       -> GET/POST -> estadísticas de partidos + alta manual
```

## Despliegue (Cloudflare Pages)

1. Sube esta carpeta a un repo de GitHub (puede ser público, no contiene datos personales).
2. En Cloudflare Dashboard -> Workers & Pages -> Create -> Pages -> conecta ese repo.
   - Build command: (ninguno)
   - Build output directory: `public`
3. En Settings -> Environment variables (Production y Preview), añade:
   - `GITHUB_TOKEN`  -> token con permiso `contents:write` SOLO sobre el repo `bluepulse-data`
   - `DATA_REPO`     -> `tu_usuario/bluepulse-data`
   - `DATA_BRANCH`   -> `main`
   - `APP_PASSWORD`  -> la contraseña que quieras usar para añadir partidos manualmente
4. Deploy. La URL que te da Cloudflare (algo.pages.dev) ya es la webapp completa.

## Desarrollo local

```
npm install
cp .dev.vars.example .dev.vars   # y rellena tus valores
npm run dev
```

## Notas de seguridad

- El `GITHUB_TOKEN` vive SOLO como variable de entorno de Cloudflare (Functions,
  lado servidor). Nunca llega al navegador — por eso hacía falta Cloudflare
  Functions en vez de GitHub Pages a secas.
- El login es intencionadamente simple (una contraseña compartida, cookie
  `HttpOnly` + `Secure`), acorde a que esto es una app personal de un solo
  usuario, no un producto multiusuario.
- Las lecturas (`/api/wellness`, `/api/garmin`, `/api/partidos` GET) son
  públicas por simplicidad; si en algún momento te preocupa que la URL de
  Cloudflare se filtre, se puede exigir la misma cookie de sesión también
  para GET.
