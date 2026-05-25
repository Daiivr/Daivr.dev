const axios = require('axios')

const DEFAULT_AVATAR_URL = 'https://cdn.discordapp.com/embed/avatars/0.png'

// Cache simple en memoria para no spamear la API de Discord.
// key: `${userId}:${size}` -> { profile, exp }
const cache = new Map()
const TTL_MS = 1000 * 60 * 60 * 6 // 6 horas

function setCache(key, profile) {
  cache.set(key, { profile, exp: Date.now() + TTL_MS })
  return profile
}

function fallbackProfile(fallback = {}) {
  return {
    displayName: fallback.displayName || null,
    avatarUrl: fallback.avatarUrl || DEFAULT_AVATAR_URL,
  }
}

/**
 * Devuelve el perfil visible ACTUAL de un usuario de Discord usando el Bot Token.
 * Si no hay token (o falla la petición), conserva el fallback recibido.
 */
async function getDiscordUserProfile(userId, size = 64, fallback = {}) {
  const key = `${userId}:${size}`
  const hit = cache.get(key)
  if (hit && hit.exp > Date.now()) return hit.profile

  const token = process.env.DISCORD_BOT_TOKEN
  if (!token) {
    return fallbackProfile(fallback)
  }

  try {
    const { data } = await axios.get(`https://discord.com/api/v10/users/${userId}`, {
      headers: { Authorization: `Bot ${token}` },
      timeout: 8000,
    })

    const profile = {
      displayName: data?.global_name || data?.username || fallback.displayName || null,
      avatarUrl: data?.avatar
        ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png?size=${size}`
        : DEFAULT_AVATAR_URL,
    }

    return setCache(key, profile)
  } catch (e) {
    return fallbackProfile(fallback)
  }
}

async function getDiscordAvatarUrl(userId, size = 64, fallbackUrl = DEFAULT_AVATAR_URL) {
  const profile = await getDiscordUserProfile(userId, size, { avatarUrl: fallbackUrl })
  return profile.avatarUrl
}

module.exports = { DEFAULT_AVATAR_URL, getDiscordAvatarUrl, getDiscordUserProfile }
