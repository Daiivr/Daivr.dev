import React, { useEffect, useState } from 'react'

const GAMES = [
  {
    title: 'NieR:Automata',
    kicker: 'favorito.01',
    meta: 'señal YoRHa',
    genre: 'RPG de acción',
    steamAppId: 524220,
    image: '/games/nier-automata-cover.png',
    logo: '/games/nier-automata-logo.webp',
    character: '/games/nier-2b.png',
    accent: 'yorha',
  },
  {
    title: 'Fallout 76',
    kicker: 'favorito.02',
    meta: 'señal Appalachia',
    genre: 'RPG en línea',
    steamAppId: 1151340,
    image: '/games/fallout-76-poster.png',
    logo: '/games/fallout-76-logo.png',
    character: '/games/fallout-76-power-armor.png',
    accent: 'vault',
  },
  {
    title: 'Red Dead Redemption II',
    kicker: 'favorito.03',
    meta: 'señal Van der Linde',
    genre: 'aventura western',
    steamAppId: 1174180,
    image: '/games/rdr2-cover.png',
    logo: '/games/rdr2-logo.png',
    character: '/games/rdr2-arthur.png',
    accent: 'outlaw',
  },
]

function formatPlaytime(record, status) {
  if (status === 'loading') return 'steam sincronizando'
  if (status === 'unconfigured') return 'steam no vinculado'
  if (status === 'error') return 'steam sin conexión'
  if (!record?.available || !Number.isFinite(record.playtimeMinutes)) {
    return 'horas privadas'
  }

  const minutes = record.playtimeMinutes
  if (minutes < 60) return `${minutes}m jugados`

  const hours = minutes / 60
  const formatted = hours >= 100 ? Math.round(hours) : Math.round(hours * 10) / 10
  return `${formatted}h jugadas`
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
            <h2 className="section-title">Estante de juegos</h2>
            <p className="game-shelf-subtitle">juegos favoritos - archivo de portadas</p>
          </div>
          <div className="game-shelf-stats" aria-hidden="true">
            <span>{String(activeGames).padStart(2, '0')} cargados</span>
            <span>3d:activo</span>
            <span>estante:en vivo</span>
          </div>
        </header>

        <div className="game-shelf-stage" aria-label="Estante de juegos favoritos">
          <div className="game-shelf-hud" aria-hidden="true">
            <span className="game-shelf-hud-corner game-shelf-hud-tl" />
            <span className="game-shelf-hud-corner game-shelf-hud-tr" />
            <span className="game-shelf-hud-corner game-shelf-hud-bl" />
            <span className="game-shelf-hud-corner game-shelf-hud-br" />
            <span className="game-shelf-hud-tag game-shelf-hud-bay">bay // a.01-03</span>
            <span className="game-shelf-hud-tag game-shelf-hud-sync">
              <i /> sync // ok
            </span>
          </div>
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
                        alt={`Portada de ${game.title}`}
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
                  <span className="game-card-kicker">{game.kicker}</span>
                  <strong>{game.title}</strong>
                  <em>{game.meta}</em>
                  <small>{game.genre}</small>
                  <small className="game-card-hours">
                    {formatPlaytime(
                      steamPlaytime.games[String(game.steamAppId)],
                      steamPlaytime.status,
                    )}
                  </small>
                  <span className="game-card-serial" aria-hidden="true">
                    sn//{String(game.steamAppId).padStart(7, '0')}
                  </span>
                  <span className="game-card-barcode" aria-hidden="true" />
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="game-shelf-readout" aria-hidden="true">
          <span>
            <i /> rack online
          </span>
          <span className="game-shelf-readout-dots">··· ··· ···</span>
          <span>{String(activeGames).padStart(2, '0')}/03 portadas</span>
        </div>
      </div>
    </section>
  )
}
