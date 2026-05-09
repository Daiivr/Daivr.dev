import React, { useEffect, useState } from 'react'

const GAMES = [
  {
    title: 'NieR:Automata',
    kicker: 'favorite.01',
    meta: 'YoRHa signal',
    genre: 'action RPG',
    steamAppId: 524220,
    image: '/games/nier-automata-cover.png',
    logo: '/games/nier-automata-logo.webp',
    character: '/games/nier-2b.png',
    accent: 'yorha',
  },
  {
    title: 'Fallout 76',
    kicker: 'favorite.02',
    meta: 'Appalachia signal',
    genre: 'online RPG',
    steamAppId: 1151340,
    image: '/games/fallout-76-poster.png',
    logo: '/games/fallout-76-logo.png',
    character: '/games/fallout-76-power-armor.png',
    accent: 'vault',
  },
  {
    title: 'Red Dead Redemption II',
    kicker: 'favorite.03',
    meta: 'Van der Linde signal',
    genre: 'western adventure',
    steamAppId: 1174180,
    image: '/games/rdr2-cover.png',
    logo: '/games/rdr2-logo.png',
    character: '/games/rdr2-arthur.png',
    accent: 'outlaw',
  },
]

function formatPlaytime(record, status) {
  if (status === 'loading') return 'steam syncing'
  if (status === 'unconfigured') return 'steam not linked'
  if (status === 'error') return 'steam offline'
  if (!record?.available || !Number.isFinite(record.playtimeMinutes)) {
    return 'hours private'
  }

  const minutes = record.playtimeMinutes
  if (minutes < 60) return `${minutes}m played`

  const hours = minutes / 60
  const formatted = hours >= 100 ? Math.round(hours) : Math.round(hours * 10) / 10
  return `${formatted}h played`
}

export default function GameShelf() {
  const activeGames = GAMES.filter((game) => !game.pending).length
  const [steamPlaytime, setSteamPlaytime] = useState({
    status: 'loading',
    games: {},
  })

  useEffect(() => {
    let cancelled = false

    fetch('/api/steam-playtime')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (cancelled) return

        setSteamPlaytime({
          status: data.configured === false ? 'unconfigured' : data.error ? 'error' : 'ready',
          games: data.games || {},
        })
      })
      .catch(() => {
        if (!cancelled) {
          setSteamPlaytime({ status: 'error', games: {} })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section id="games" className="mx-auto max-w-6xl px-4 py-8">
      <div className="section-card game-shelf-panel">
        <header className="game-shelf-header">
          <div>
            <h2 className="section-title">Game Shelf</h2>
            <p className="game-shelf-subtitle">favorite games - cover archive</p>
          </div>
          <div className="game-shelf-stats" aria-hidden="true">
            <span>{String(activeGames).padStart(2, '0')} loaded</span>
            <span>3d:on</span>
            <span>shelf:live</span>
          </div>
        </header>

        <div className="game-shelf-stage" aria-label="Favorite games shelf">
          <div className="game-shelf-rail" aria-hidden="true" />
          <div className="game-shelf-grid">
            {GAMES.map((game) => (
              <article
                key={game.kicker}
                className={`game-card game-card-${game.accent}${
                  game.pending ? ' is-pending' : ''
                }`}
                tabIndex="0"
              >
                <div className="game-card-scene">
                  <div className="game-card-wrapper">
                    {game.image ? (
                      <img
                        src={game.image}
                        alt={`${game.title} cover`}
                        className="game-card-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="game-card-placeholder" aria-hidden="true">
                        <span />
                      </div>
                    )}
                  </div>

                  {game.character && (
                    <img
                      src={game.character}
                      alt=""
                      className="game-card-character"
                      loading="lazy"
                      decoding="async"
                      aria-hidden="true"
                    />
                  )}

                  {game.logo ? (
                    <div className="game-card-title game-card-title-logo" aria-hidden="true">
                      <img
                        src={game.logo}
                        alt=""
                        className="game-card-logo"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  ) : (
                    <div className="game-card-title" aria-hidden="true">
                      <span>{game.title}</span>
                    </div>
                  )}
                </div>

                <div className="game-card-meta">
                  <span>{game.kicker}</span>
                  <strong>{game.title}</strong>
                  <em>{game.meta}</em>
                  <small>{game.genre}</small>
                  <small className="game-card-hours">
                    {formatPlaytime(
                      steamPlaytime.games[String(game.steamAppId)],
                      steamPlaytime.status,
                    )}
                  </small>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
