import React, { useEffect, useState } from 'react'
import axios from 'axios'

const DISCORD_ID = '271701484922601472'
const LANYARD_WS = 'wss://api.lanyard.rest/socket'


// ----- BADGES FROM DISCORD PUBLIC FLAGS -----
const BADGES = {
  HYPESQUAD_BRAVERY: {
    flag: 64,
    icon: "https://raw.githubusercontent.com/merlinfuchs/discord-badges/main/SVG/hypesquad_bravery.svg",
    label: "Bravery",
  },
  HYPESQUAD_BRILLIANCE: {
    flag: 128,
    icon: "https://raw.githubusercontent.com/merlinfuchs/discord-badges/main/SVG/hypesquad_brilliance.svg",
    label: "Brilliance",
  },
  HYPESQUAD_BALANCE: {
    flag: 256,
    icon: "https://raw.githubusercontent.com/merlinfuchs/discord-badges/main/SVG/hypesquad_balance.svg",
    label: "Balance",
  },
  EARLY_SUPPORTER: {
    flag: 512,
    icon: "https://raw.githubusercontent.com/merlinfuchs/discord-badges/main/SVG/early_supporter.svg",
    label: "Early Supporter",
  }
};

function getUserBadges(flags) {
  return Object.values(BADGES).filter(b => (flags & b.flag) !== 0);
}
// ----- END BADGES -----

export default function DiscordCard() {
  const [data, setData] = useState(null)
  const [connected, setConnected] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [gameImageUrl, setGameImageUrl] = useState(null)

  // WebSocket Lanyard
  useEffect(() => {
    const ws = new WebSocket(LANYARD_WS)
    let heartbeat = null

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data)

      if (payload.op === 1) {
        const interval = payload.d.heartbeat_interval
        heartbeat = setInterval(() => {
          ws.send(JSON.stringify({ op: 3 }))
        }, interval)

        ws.send(
          JSON.stringify({
            op: 2,
            d: { subscribe_to_id: DISCORD_ID },
          })
        )
      }

      if (
        payload.op === 0 &&
        (payload.t === 'INIT_STATE' || payload.t === 'PRESENCE_UPDATE')
      ) {
        let userData = payload.d
        if (userData && userData[DISCORD_ID]) {
          userData = userData[DISCORD_ID]
        }
        setData(userData)
        setConnected(true)
      }
    }

    ws.onclose = () => {
      if (heartbeat) clearInterval(heartbeat)
      setConnected(false)
    }

    return () => {
      if (heartbeat) clearInterval(heartbeat)
      ws.close()
    }
  }, [])

  // ticker 1s para actualizar progreso
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const user = data?.discord_user
  const presence = data?.discord_status
  const activities = data?.activities ?? []
  const customStatus = activities.find((a) => a.type === 4)
  const mainActivity = activities.find((a) => a.type === 0)
  const spotify = data?.spotify
  const hasRichPresenceImage = !!(
    mainActivity &&
    mainActivity.assets &&
    mainActivity.assets.large_image &&
    mainActivity.application_id
  )


  const statusColor =
    {
      online: 'bg-emerald-400',
      idle: 'bg-amber-300',
      dnd: 'bg-rose-500',
      offline: 'bg-slate-500',
    }[presence || 'offline']

  const formatTime = (ms) => {
    if (!ms || ms < 0) return '0:00'
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  
function formatElapsedTs(start) {
  const diff = Date.now() - start;
  const totalSec = Math.floor(diff/1000);
  const hrs = Math.floor(totalSec/3600);
  const min = Math.floor((totalSec%3600)/60);
  return hrs>0 ? `${hrs}h ${min}m` : `${min}m`;
}

const formatDuration = (ms) => {
    if (!ms || ms <= 0) return null
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const fallbackElapsed = mainActivity?.timestamps?.start ? formatElapsedTs(mainActivity.timestamps.start) : null;
const rawSessionMs = data?.kv?.session_duration_ms || 0
  const gameSessionLabel = formatDuration(rawSessionMs)


  useEffect(() => {
    if (!mainActivity || !mainActivity.name) {
      setGameImageUrl(null)
      return
    }

    if (hasRichPresenceImage) {
      setGameImageUrl(null)
      return
    }

    let cancelled = false

    const load = async () => {
      try {
        const res = await axios.get('/api/game-image', {
          params: { name: mainActivity.name },
        })
        if (!cancelled) {
          setGameImageUrl(res.data?.url || null)
        }
      } catch (err) {
        console.error('Error fetching game image', err)
        if (!cancelled) {
          setGameImageUrl(null)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [mainActivity?.name, hasRichPresenceImage])

  const getSpotifyProgress = () => {
    if (!spotify || !spotify.timestamps) return 0
    const start = Number(spotify.timestamps.start)
    const end = Number(spotify.timestamps.end)
    if (!start || !end || end <= start) return 0
    const clampedNow = Math.min(Math.max(now, start), end)
    const total = end - start
    return (clampedNow - start) / total * 100
  }

  const spotifyTimes = (() => {
    if (!spotify || !spotify.timestamps) return null
    const start = Number(spotify.timestamps.start)
    const end = Number(spotify.timestamps.end)
    if (!start || !end || end <= start) return null
    const clampedNow = Math.min(Math.max(now, start), end)
    const total = end - start
    const current = clampedNow - start
    return {
      currentLabel: formatTime(current),
      totalLabel: formatTime(total),
    }
  })()

  return (
    <section id="discord" className="mx-auto max-w-6xl px-4 py-6">
      <div className="section-card flex flex-col gap-6 md:flex-row">
        <div className="w-full md:w-64 flex flex-col items-center">
          


        <div className="relative group">
          <div className="relative h-28 w-28">
            <img
              src={
                user?.id && user?.avatar
                  ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=512`
                  : 'https://cdn.discordapp.com/embed/avatars/0.png'
              }
              alt={user?.username || 'Discord avatar'}
              className="h-28 w-28 rounded-full object-cover shadow-xl"
            />
            {user?.avatar_decoration_data?.asset && (
              <img
                src={`https://cdn.discordapp.com/avatar-decoration-presets/${user.avatar_decoration_data.asset}.png`}
                alt="Avatar decoration"
                className="pointer-events-none absolute inset-0 h-28 w-28 scale-[1.14]"
              />
            )}
          </div>

          <span
            className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-slate-900 ${statusColor}`}
          />
        </div>

          <p className="text-lg font-semibold text-slate-100 mt-4">

            {user?.global_name || user?.username || 'Cargando…'}
          </p>
          <p className="text-sm text-slate-400">@{user?.username || '...'}</p>

          <p className="mt-2 text-xs text-slate-500">
            {customStatus?.state ||
              (presence === 'online' && 'Construyendo cosas y rompiéndolas otra vez ✨') ||
              (presence === 'idle' && 'AFK pero de buen humor 💤') ||
              (presence === 'dnd' && 'Modo sweat, no molestar 🔥') ||
              (presence === 'offline' && 'Desconectado (o invis) 👻') ||
              (!connected && 'Conectando a Lanyard…')}
          </p>

          
<div className="flex flex-wrap gap-2 mt-4 justify-center">
  {getUserBadges(user?.public_flags || 0).map((badge) => (
    <div
      key={badge.label}
      className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/60 border border-slate-700 shadow-sm"
    >
      <img src={badge.icon} className="h-4 w-4" />
      <span className="text-[11px] text-slate-200">{badge.label}</span>
    </div>
  ))}
</div>

        </div>

        <div className="flex-1 bg-slate-900/40 rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-slate-200 font-semibold">Actividad</h3>
            <span className="text-xs text-slate-400">
              {activities.length} activa{activities.length === 1 ? '' : 's'}
            </span>
          </div>

          {mainActivity && (
            <div className="mt-4 flex gap-4 items-center">
              {(hasRichPresenceImage || gameImageUrl) && (
                <img
                  src={
                    hasRichPresenceImage
                      ? `https://cdn.discordapp.com/app-assets/${mainActivity.application_id}/${mainActivity.assets.large_image}.png`
                      : gameImageUrl
                  }
                  className="h-16 w-16 rounded-xl object-cover border border-slate-800"
                  alt={mainActivity.name}
                />
              )}
              <div className="text-sm">
                <p className="text-slate-100 font-medium">{mainActivity.name}</p>
                {mainActivity.details && (
                  <p className="text-slate-400 text-xs">{mainActivity.details}</p>
                )}
                {mainActivity.state && (
                  <p className="text-slate-500 text-xs">{mainActivity.state}</p>
                )}
                {(fallbackElapsed || gameSessionLabel) && (
                  <p className="text-emerald-400 text-xs mt-1">
                    Jugando hace {fallbackElapsed || gameSessionLabel}
                  </p>
                )}
              </div>
            </div>
          )}

          {spotify && (
            <div className="mt-6 grid gap-4 sm:grid-cols-[auto,1fr] items-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-emerald-500/40 blur-lg" />
                <img
                  src={spotify.album_art_url}
                  alt={spotify.song}
                  className="relative h-20 w-20 rounded-xl object-cover border border-slate-800 shadow-lg"
                />
              </div>
              <div>
                <p className="text-slate-100 text-sm font-semibold">Spotify</p>
                <p className="text-slate-200 text-sm">{spotify.song}</p>
                <p className="text-slate-400 text-xs mb-2">{spotify.artist}</p>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 via-fuchsia-400 to-slate-500 transition-all"
                    style={{ width: `${getSpotifyProgress()}%` }}
                  />
                </div>
                {spotifyTimes && (
                  <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                    <span>{spotifyTimes.currentLabel}</span>
                    <span>{spotifyTimes.totalLabel}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {!mainActivity && !spotify && (
            <p className="mt-4 text-xs text-slate-500">
              Ahora mismo no hay actividades visibles (juego / Spotify / etc).
            </p>
          )}
        </div>
      </div>
    </section>
  )
}