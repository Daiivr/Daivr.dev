import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import nitroRubyBadge from '../assets/discord-badge-nitro-ruby-card.png'
import nitroRubyTooltipBadgeMarkup from '../assets/discord-badge-nitro-ruby-tooltip.svg?raw'
import originallyKnownBadge from '../assets/discord-badge-originally-known-as.png'
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
    tooltipMarkup: nitroRubyTooltipBadgeMarkup,
    label: "NITRO RUBY",
    sublabel: "Subscriber since 9/6/20",
    variant: "nitro-ruby",
  },
  {
    icon: serverBoostBadge,
    label: "Server boosting since Sep 12, 2020",
  },
  {
    icon: originallyKnownBadge,
    label: "Originally known as Dai \u2601",
    sublabel: "#4505",
    tooltipWidth: 210,
  },
]

function getUserBadges(user) {
  if (!user) return []
  const flags = user.public_flags || 0
  const list = BADGES.filter(b => (flags & b.flag) !== 0)
  return [...list, ...CUSTOM_BADGES]
}
// ----- END BADGES -----

function getActivityAssetUrl(activity, assetKey, size = 128) {
  if (!activity || !assetKey) return null

  const key = String(assetKey)
  if (/^https?:\/\//i.test(key)) return key

  if (key.startsWith('mp:external/')) {
    return `https://media.discordapp.net/${key.slice(3)}`
  }

  if (key.startsWith('external/')) {
    return `https://media.discordapp.net/${key}`
  }

  if (key.startsWith('spotify:')) {
    return `https://i.scdn.co/image/${key.slice('spotify:'.length)}`
  }

  if (!activity.application_id) return null

  return `https://cdn.discordapp.com/app-assets/${activity.application_id}/${key}.png?size=${size}`
}

export default function DiscordCard() {
  const [data, setData] = useState(null)
  const [connected, setConnected] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [gameImageUrl, setGameImageUrl] = useState(null)
  const [badgeTooltip, setBadgeTooltip] = useState(null)
  const [streak, setStreak] = useState(null)

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

  // streak local (server-tracked vía Lanyard polling)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await axios.get('/api/discord-streak')
        if (!cancelled) setStreak(res.data || null)
      } catch (err) {
        if (!cancelled) setStreak(null)
      }
    }
    load()
    const id = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
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
  const activityArtUrl = hasRichPresenceImage
    ? getActivityAssetUrl(mainActivity, mainActivity.assets.large_image, 256)
    : gameImageUrl
  const activityAppIconUrl = getActivityAssetUrl(
    mainActivity,
    mainActivity?.assets?.small_image,
    96,
  )
  const activityAppIconAlt =
    mainActivity?.assets?.small_text || `${mainActivity?.name || 'Activity'} icon`


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

  const activityCount = activities.filter((activity) => activity.type !== 4).length
  const profileName = user?.global_name || user?.username || 'Cargando...'
  const username = user?.username || '...'
  const presenceLabel = presence || (connected ? 'offline' : 'connecting')
  const avatarUrl =
    user?.id && user?.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=512`
      : 'https://cdn.discordapp.com/embed/avatars/0.png'


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
  const hasGameStreak = Boolean(
    streak?.alive &&
      streak.streak > 1 &&
      mainActivity?.name &&
      streak.game === mainActivity.name,
  )
  const hasActivitySession = Boolean(fallbackElapsed || gameSessionLabel)
  const showInlineStreak = hasGameStreak && hasRichPresenceImage && hasActivitySession

  const showBadgeTooltip = (badge, element) => {
    const rect = element.getBoundingClientRect()
    const anchorX = rect.left + rect.width / 2
    const isNitroRuby = badge.variant === 'nitro-ruby'
    const tooltipWidth = isNitroRuby ? 244 : (badge.tooltipWidth || 140)
    const viewportPadding = 12
    const minLeft = viewportPadding + tooltipWidth / 2
    const maxLeft = Math.max(minLeft, window.innerWidth - viewportPadding - tooltipWidth / 2)
    const left = Math.min(Math.max(anchorX, minLeft), maxLeft)

    setBadgeTooltip({
      label: badge.label,
      sublabel: badge.sublabel,
      icon: badge.tooltipIcon || badge.icon,
      markup: badge.tooltipMarkup,
      variant: badge.variant,
      arrowOffset: anchorX - left,
      left,
      top: rect.top - 14,
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
      <div className="section-card discord-card-shell">
        <div className="discord-profile-panel">
          <div className="discord-profile-topline">
            <span>discord.presence</span>
            <span className={`discord-live-dot is-${presenceLabel}`} />
          </div>

          <div className="discord-avatar-stage">
            <div className="discord-avatar-ring">
              <img
                src={avatarUrl}
                alt={username || 'Discord avatar'}
                className="discord-avatar"
                decoding="async"
              />
              {user?.avatar_decoration_data?.asset && (
                <img
                  src={`https://cdn.discordapp.com/avatar-decoration-presets/${user.avatar_decoration_data.asset}.png`}
                  alt="Avatar decoration"
                  className="discord-avatar-decoration"
                />
              )}
            </div>
            <span className={`discord-status-dot ${statusColor}`} />
          </div>

          <div className="discord-identity">
            <div className="discord-display-name">
              <span>{profileName}</span>
              {hasGuildTag && (
                <span
                  className="discord-guild-pill"
                  tabIndex="0"
                  aria-label={`Server tag: ${primaryGuild.tag}`}
                >
                  <img src={guildBadgeUrl} alt="" loading="lazy" />
                  <span>{primaryGuild.tag}</span>
                  <span className="discord-guild-tooltip" role="tooltip">
                    <span className="discord-guild-tooltip-kicker">
                      server.tag
                    </span>
                    <span className="discord-guild-tooltip-main">
                      <img src={guildBadgeUrl} alt="" loading="lazy" />
                      <strong>{primaryGuild.tag}</strong>
                    </span>
                    <span className="discord-guild-tooltip-sub">
                      Primary guild identity
                    </span>
                  </span>
                </span>
              )}
            </div>
            <p>@{username}</p>
          </div>

          <div className="discord-presence-row">
            <span className="discord-presence-key">{presenceLabel}</span>
            <span className="discord-presence-value">
              {connected ? 'lanyard.live' : 'connecting'}
            </span>
          </div>

          <div className="discord-custom-status">
            {customStatus?.emoji?.id && (
              <img
                src={`https://cdn.discordapp.com/emojis/${customStatus.emoji.id}.${
                  customStatus.emoji.animated ? 'gif' : 'png'
                }?size=32&quality=lossless`}
                alt={customStatus.emoji.name || ''}
                loading="lazy"
              />
            )}
            {customStatus?.emoji?.name && !customStatus?.emoji?.id && (
              <span>{customStatus.emoji.name}</span>
            )}
            <p>
              {customStatus?.state ||
                (presence === 'online' && 'Construyendo cosas y rompiéndolas otra vez') ||
                (presence === 'idle' && 'AFK pero de buen humor') ||
                (presence === 'dnd' && 'Modo focus activo') ||
                (presence === 'offline' && 'Desconectado o invisible') ||
                (!connected && 'Conectando a Lanyard...')}
            </p>
          </div>

          {(() => {
            const badges = getUserBadges(user)
            if (!badges.length) return null
            return (
              <div className="discord-badge-row">
                <div className="discord-badge-dock">
                  {badges.map((badge) => (
                    <div
                      key={badge.label}
                      className="discord-badge-item"
                      tabIndex={0}
                      onMouseEnter={(event) => showBadgeTooltip(badge, event.currentTarget)}
                      onMouseLeave={hideBadgeTooltip}
                      onFocus={(event) => showBadgeTooltip(badge, event.currentTarget)}
                      onBlur={hideBadgeTooltip}
                    >
                      <img
                        src={badge.icon}
                        alt={badge.label}
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>

        <div className="discord-activity-panel">
          <div className="discord-activity-header">
            <div>
              <p className="discord-activity-kicker">activity.stream</p>
              <h3>Actividad</h3>
            </div>
            <span>
              {activityCount} activa{activityCount === 1 ? '' : 's'}
            </span>
          </div>

          {mainActivity && (
            <div className="discord-activity-card">
              {activityArtUrl && (
                <div className="discord-activity-art">
                  <img
                    src={activityArtUrl}
                    alt={mainActivity.name}
                    className="discord-activity-main-art"
                    loading="lazy"
                    decoding="async"
                  />
                  {activityAppIconUrl && (
                    <span className="discord-activity-app-icon">
                      <img
                        src={activityAppIconUrl}
                        alt={activityAppIconAlt}
                        loading="lazy"
                        decoding="async"
                      />
                    </span>
                  )}
                </div>
              )}
              <div className="discord-activity-copy">
                <p className="discord-activity-name">{mainActivity.name}</p>
                {mainActivity.details && (
                  <p className="discord-activity-detail">{mainActivity.details}</p>
                )}
                {mainActivity.state && (
                  <p className="discord-activity-state">{mainActivity.state}</p>
                )}
                {hasActivitySession && (
                  <div className="discord-activity-session">
                    <span />
                    Jugando hace {fallbackElapsed || gameSessionLabel}
                    {showInlineStreak && (
                      <span
                        className="discord-streak-chip discord-streak-chip-inline"
                        title={`Has jugado ${mainActivity.name} ${streak.streak} días seguidos`}
                      >
                        <span aria-hidden="true">⚡</span>
                        {streak.streak}x Streak
                      </span>
                    )}
                  </div>
                )}
                {hasGameStreak && !showInlineStreak && (
                    <div className="discord-activity-streak-row">
                      <span
                        className="discord-streak-chip"
                        title={`Has jugado ${mainActivity.name} ${streak.streak} días seguidos`}
                      >
                        <span aria-hidden="true">⚡</span>
                        {streak.streak}x Streak
                      </span>
                    </div>
                  )}
              </div>
            </div>
          )}

          {spotify && (
            <div className="discord-spotify-card">
              <div className="discord-spotify-art">
                <img
                  src={spotify.album_art_url}
                  alt={spotify.song}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="discord-spotify-copy">
                <p className="discord-activity-kicker">spotify.now</p>
                <p className="discord-spotify-song">{spotify.song}</p>
                <p className="discord-spotify-artist">{spotify.artist}</p>
                <div className="discord-spotify-progress">
                  <div
                    style={{ width: `${getSpotifyProgress()}%` }}
                  />
                </div>
                {spotifyTimes && (
                  <div className="discord-spotify-time">
                    <span>{spotifyTimes.currentLabel}</span>
                    <span>{spotifyTimes.totalLabel}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {!mainActivity && !spotify && (
            <p className="discord-empty-activity">
              Ahora mismo no hay actividades visibles (juego / Spotify / etc).
            </p>
          )}
        </div>
      </div>
      {badgeTooltip &&
        createPortal(
          <div
            className={`discord-floating-tooltip ${
              badgeTooltip.variant ? `is-${badgeTooltip.variant}` : ''
            }`}
            style={{
              left: `${badgeTooltip.left}px`,
              top: `${badgeTooltip.top}px`,
              '--tooltip-arrow-offset': `${badgeTooltip.arrowOffset || 0}px`,
            }}
            role="tooltip"
          >
            {badgeTooltip.variant === 'nitro-ruby' && (
              <span
                className="discord-nitro-tooltip-badge"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: badgeTooltip.markup }}
              />
            )}
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
