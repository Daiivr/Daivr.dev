import React from 'react'

export default function About() {
  return (
    <section id="about" className="section-shell">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Sobre mí */}
        <div className="section-card about-card">
          <div className="about-card-header">
            <div>
              <h2 className="section-title">about.md</h2>
              <p className="about-card-subtitle">
                <span className="dot" /> readme · 2 paragraphs · utf-8
              </p>
            </div>
            <span className="about-card-status">
              <span aria-hidden="true" />
              active
            </span>
          </div>

          <div className="about-copy-panel">
            <p>
              Soy <span>Dai</span>: dev full-stack basada en Alaska, con un café
              frío al lado y demasiadas pestañas abiertas. Construyo bots de
              Discord, herramientas SysBot y webs mimadas; me gusta romper cosas
              con código y luego dejarlas mejor que como las encontré.
            </p>
            <p>
              EN/ES. Grindo XP en Visual Studio entre anime y lo-fi, casi siempre
              perdida en Fallout, Minecraft, VRChat o DBD. Esta página es mi hub:
              proyectos, links, screenshots y presencia de Discord en vivo.
            </p>
          </div>

          <div className="about-signal-grid" aria-label="About quick facts">
            <div className="about-signal-card">
              <span>focus</span>
              <strong>bots + tools</strong>
            </div>
            <div className="about-signal-card">
              <span>runtime</span>
              <strong>night build</strong>
            </div>
            <div className="about-signal-card">
              <span>mode</span>
              <strong>lo-fi loop</strong>
            </div>
          </div>

          <div className="about-footer-panel">
            <div className="about-footer-top">
              <span>session.trace</span>
              <span>stable</span>
            </div>
          </div>
        </div>

        {/* Mini ficha */}
        <div className="section-card profile-card">
          <div className="profile-card-header">
            <div>
              <h3 className="section-title">profile.json</h3>
              <p className="profile-card-subtitle">identity · stack · active projects</p>
            </div>
            <span className="profile-status-pill">
              <span aria-hidden="true" />
              live
            </span>
          </div>

          <dl className="profile-grid">
            <div className="profile-field">
              <dt>location</dt>
              <dd>
                Alaska
                <span>snow + <span className="rgb-text">RGB</span></span>
              </dd>
            </div>

            <div className="profile-field">
              <dt>role</dt>
              <dd>
                Developer
                <span>bots · games · tools</span>
              </dd>
            </div>

            <div className="profile-field">
              <dt>stack</dt>
              <dd>
                TS · React · C#
                <span>Unity · Node</span>
              </dd>
            </div>

            <div className="profile-field">
              <dt>mood</dt>
              <dd>
                Grinding XP
                <span>03:00 build window</span>
              </dd>
            </div>
          </dl>

          <div className="profile-projects">
            <div className="profile-projects-top">
              <span>projects</span>
              <span>3 pinned</span>
            </div>
            <div className="profile-project-list">
              <span className="profile-project-chip">DaiBot</span>
              <a
                href="https://github.com/Daiivr/PokeNexo"
                target="_blank"
                rel="noreferrer"
                className="profile-project-chip"
              >
                PokeNexo
              </a>
              <span className="profile-project-chip">Emoji Bank</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
