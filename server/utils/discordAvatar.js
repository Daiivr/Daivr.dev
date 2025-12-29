const axios = require('axios')

// Cache simple en memoria para no spamear la API de Discord.
// key: `${userId}:${size}` -> { url, exp }
const cache = new Map()
const TTL_MS = 1000 * 60 * 60 * 6 // 6 horas

function setCache(key, url) {
  cache.set(key, { url, exp: Date.now() + TTL_MS })
  return url
}

/**
 * Devuelve el avatar ACTUAL de un usuario de Discord usando el Bot Token.
 * Si no hay token (o falla la petición), devuelve un avatar por defecto para evitar imágenes rotas.
 */
async function getDiscordAvatarUrl(userId, size = 64) {
  const key = `${userId}:${size}`
  const hit = cache.get(key)
  if (hit && hit.exp > Date.now()) return hit.url

  const token = process.env.DISCORD_BOT_TOKEN
  if (!token) {
    // Sin token no podemos resolver el hash actual del avatar
    return setCache(key, 'https://cdn.discordapp.com/embed/avatars/0.png')
  }

  try {
    const { data } = await axios.get(`https://discord.com/api/v10/users/${userId}`, {
      headers: { Authorization: `Bot ${token}` },
      timeout: 8000,
    })

    const url = data?.avatar
      ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png?size=${size}`
      : 'https://cdn.discordapp.com/embed/avatars/0.png'

    return setCache(key, url)
  } catch (e) {
    return setCache(key, 'https://cdn.discordapp.com/embed/avatars/0.png')
  }
}

module.exports = { getDiscordAvatarUrl }
