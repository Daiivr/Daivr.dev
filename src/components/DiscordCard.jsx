import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import nitroRubyBadge from '../assets/discord-badge-nitro-ruby.svg'
import serverBoostBadge from '../assets/discord-badge-boost.svg'

const DISCORD_ID = '271701484922601472'
const LANYARD_WS = 'wss://api.lanyard.rest/socket'


// ----- BADGES FROM DISCORD PUBLIC FLAGS -----
const BADGE_BASE = "https://raw.githubusercontent.com/merlinfuchs/discord-badges/main/SVG"

const BADGES = [
  { flag: 1 << 0,  icon: `${BADGE_BASE}/discord_employee.svg`,             label: "Discord Staff" },
  { flag: 1 << 1,  icon: `${BADGE_BASE}/partnered_server_owner.svg`,        label: "Partnered Server Owner" },
  { flag: 1 << 2,  icon: `${BADGE_BASE}/hypesquad_events.svg`,              label: "HypeSquad Events" },
  { flag: 1 << 3,  icon: `${BADGE_BASE}/bug_hunter_level_1.svg`,            label: "Bug Hunter" },
  { flag: 1 << 6,  icon: `${BADGE_BASE}/hypesquad_bravery.svg`,             label: "HypeSquad Bravery" },
  { flag: 1 << 7,  icon: `${BADGE_BASE}/hypesquad_brilliance.svg`,          label: "HypeSquad Brilliance" },
  { flag: 1 << 8,  icon: `${BADGE_BASE}/hypesquad_balance.svg`,             label: "HypeSquad Balance" },
  { flag: 1 << 9,  icon: `${BADGE_BASE}/early_supporter.svg`,               label: "Early Supporter" },
  { flag: 1 << 14, icon: `${BADGE_BASE}/bug_hunter_level_2.svg`,            label: "Bug Hunter Level 2" },
  { flag: 1 << 17, icon: `${BADGE_BASE}/early_verified_bot_developer.svg`,  label: "Early Verified Bot Developer" },
  { flag: 1 << 18, icon: `${BADGE_BASE}/discord_certified_moderator.svg`,   label: "Moderator Programs Alumni" },
  { flag: 1 << 22, icon: `${BADGE_BASE}/active_developer.svg`,              label: "Active Developer" },
]

// Manual extras — Lanyard/the gateway don't expose Nitro tier or server-boost
// duration on the user object, so we add them here for the profile owner.
const CUSTOM_BADGES = [
  {
    icon: nitroRubyBadge,
    label: "NITRO RUBY",
    sublabel: "Subscriber since 9/6/20",
  },
  {
    icon: serverBoostBadge,
    label: "Server boosting since Sep 12, 2020",
  },
]

function getUserBadges(user) {
  if (!user) return []
  const flags = user.public_flags || 0
  const list = BADGES.filter(b => (flags & b.flag) !== 0)
  return [...list, ...CUSTOM_BADGES]
}
// ----- END BADGES -----

export default function DiscordCard() {
  const [data, setData] = useState(null)
  const [connected, setConnected] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [gameImageUrl, setGameImageUrl] = useState(null)
  const [badgeTooltip, setBadgeTooltip] = useState(null)

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

  // Discord "Server Tag" / Primary Guild (the small clan pill next to the name)
  const primaryGuild = user?.primary_guild || user?.clan
  const hasGuildTag =
    primaryGuild?.identity_enabled &&
    primaryGuild?.tag &&
    primaryGuild?.badge &&
    primaryGuild?.identity_guild_id
  const guildBadgeUrl = hasGuildTag
    ? `https://cdn.discordapp.com/clan-badges/${primaryGuild.identity_guild_id}/${primaryGuild.badge}.png?size=32`
    : null
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

  const showBadgeTooltip = (badge, element) => {
    const rect = element.getBoundingClientRect()
    setBadgeTooltip({
      label: badge.label,
      sublabel: badge.sublabel,
      left: rect.left + rect.width / 2,
      top: rect.top - 8,
    })
  }

  const hideBadgeTooltip = () => setBadgeTooltip(null)

  useEffect(() => {
    if (!badgeTooltip) return undefined

    const dismissTooltip = () => setBadgeTooltip(null)
    window.addEventListener('scroll', dismissTooltip, true)
    window.addEventListener('resize', dismissTooltip)

    return () => {
      window.removeEventListener('scroll', dismissTooltip, true)
      window.removeEventListener('resize', dismissTooltip)
    }
  }, [badgeTooltip])

  return (
    <section id="discord" className="mx-auto max-w-6xl px-4 py-6">
      <div className="section-card flex flex-col gap-6 md:flex-row">
        <div className="discord-profile-panel w-full md:w-64 flex flex-col items-center">
          


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

          <p className="text-lg font-semibold text-slate-100 mt-4 flex items-center justify-center gap-2">
            <span>{user?.global_name || user?.username || 'Cargando…'}</span>
            {hasGuildTag && (
              <span
                className="inline-flex items-center gap-1 rounded border border-slate-700/80 bg-slate-800/70 px-1.5 py-[2px] align-middle backdrop-blur-sm leading-none"
                title={`Server Tag · ${primaryGuild.tag}`}
              >
                <img
                  src={guildBadgeUrl}
                  alt=""
                  className="h-3 w-3"
                  loading="lazy"
                />
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-100">
                  {primaryGuild.tag}
                </span>
              </span>
            )}
          </p>
          <p className="text-sm text-slate-400">@{user?.username || '...'}</p>

          <p className="mt-2 text-xs text-slate-500 inline-flex items-center justify-center gap-1.5">
            {customStatus?.emoji?.id && (
              <img
                src={`https://cdn.discordapp.com/emojis/${customStatus.emoji.id}.${
                  customStatus.emoji.animated ? 'gif' : 'png'
                }?size=32&quality=lossless`}
                alt={customStatus.emoji.name || ''}
                className="inline-block h-4 w-4 align-middle"
                loading="lazy"
              />
            )}
            {customStatus?.emoji?.name && !customStatus?.emoji?.id && (
              <span className="align-middle">{customStatus.emoji.name}</span>
            )}
            <span>
              {customStatus?.state ||
                (presence === 'online' && 'Construyendo cosas y rompiéndolas otra vez ✨') ||
                (presence === 'idle' && 'AFK pero de buen humor 💤') ||
                (presence === 'dnd' && 'Modo sweat, no molestar 🔥') ||
                (presence === 'offline' && 'Desconectado (o invis) 👻') ||
                (!connected && 'Conectando a Lanyard…')}
            </span>
          </p>

          {(() => {
            const badges = getUserBadges(user)
            if (!badges.length) return null
            return (
              <div className="discord-badge-row mt-4 flex justify-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1.5 shadow-sm">
                  {badges.map((badge) => (
                    <div
                      key={badge.label}
                      className="discord-badge-item relative inline-flex h-5 w-5 items-center justify-center"
                      tabIndex={0}
                      onMouseEnter={(event) => showBadgeTooltip(badge, event.currentTarget)}
                      onMouseLeave={hideBadgeTooltip}
                      onFocus={(event) => showBadgeTooltip(badge, event.currentTarget)}
                      onBlur={hideBadgeTooltip}
                    >
                      <img
                        src={badge.icon}
                        alt={badge.label}
                        className="h-5 w-5"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

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
      {badgeTooltip &&
        createPortal(
          <div
            className="discord-floating-tooltip"
            style={{ left: `${badgeTooltip.left}px`, top: `${badgeTooltip.top}px` }}
            role="tooltip"
          >
            <span className="discord-badge-tooltip-label">
              {badgeTooltip.label}
            </span>
            {badgeTooltip.sublabel && (
              <span className="discord-badge-tooltip-sublabel">
                {badgeTooltip.sublabel}
              </span>
            )}
          </div>,
          document.body
        )}
    </section>
  )
}
