import React from 'react'

export default function About() {
  return (
    <section id="about" className="section-shell">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Sobre mí */}
        <div className="section-card">
          <h2 className="text-sm font-semibold text-slate-100">about.md</h2>
          <p className="code-meta mt-1"><span className="dot" />readme · 2 paragraphs · utf-8</p>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">
            Soy <span className="text-sky-300">Dai</span>: dev full-stack basada en Alaska,
            con un café frío al lado y demasiadas pestañas abiertas. Construyo bots
            de Discord, herramientas SysBot y webs mimadas — me gusta romper cosas
            con código y luego dejarlas mejor que como las encontré.
          </p>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            EN/ES. Grindo XP en Visual Studio entre anime y lo-fi, casi siempre
            perdida en Fallout, Minecraft, VRChat o DBD. Esta página es mi hub:
            proyectos, links, screenshots y presencia de Discord en vivo.
          </p>
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
