# Página personal · Dai x Discord

Proyecto full‑stack sencillo para tener una página personal con:

- Sección **Sobre mí** y **links**
- **Galería** con subida de imágenes
- **Comentarios** solo para usuarios conectados con Discord
- **Tarjeta en tiempo real** con tu presencia de Discord (usando Lanyard)
- Estilo dark kawaii con glassmorphism y gradients ✨

## Requisitos

- Node.js 18+
- npm

## Instalación

```bash
npm install
cp .env.example .env
```

Edita el archivo `.env` y rellena:

- `JWT_SECRET` → cualquier cadena larga y secreta
- `DISCORD_CLIENT_ID` y `DISCORD_CLIENT_SECRET` → de tu app en Discord Developer Portal
- `DISCORD_REDIRECT_URI` → deja el valor por defecto si estás local:
  `http://localhost:4000/auth/discord/callback`

En Discord Developer Portal:

1. Crea una aplicación.
2. Ve a **OAuth2 → General**.
3. En **Redirects** agrega `http://localhost:4000/auth/discord/callback`.
4. Copia el `CLIENT ID` y `CLIENT SECRET` a tu `.env`.

## Lanyard (presencia en tiempo real)

Para que la tarjeta de Discord funcione:

1. Ve al repo de Lanyard: https://github.com/Phineas/lanyard
2. Invita el bot a uno de tus servidores (link en el README).
3. Consigue tu **Discord User ID** (Developer Mode → Copy ID).
4. Abre `src/components/DiscordCard.jsx` y pon tu ID en:

```js
const DISCORD_ID = '000000000000000000'
```

## Ejecutar en desarrollo

En una terminal:

```bash
npm run dev
```

Esto levantará:

- API en `http://localhost:4000`
- Frontend Vite en `http://localhost:5173`

## Cómo usar

1. Abre `http://localhost:5173` en tu navegador.
2. Ve a la sección **Comentarios** y presiona **Conectarse con Discord**.
3. Autoriza la app → ya puedes comentar.
4. En **Galería** puedes subir imágenes (se guardan en `/uploads`).

## Producción (básico)

Para un deploy sencillo en un VPS:

```bash
npm run build
NODE_ENV=production node server/index.js
```

Y sirve la carpeta `dist` con cualquier servidor estático (o configura un reverse proxy con Nginx hacia el Vite `preview` + API).

> Esto es un punto de partida. Puedes tunear los estilos, textos, agregar más secciones y mejorar el panel de Discord (badges, más datos del presence, etc).
