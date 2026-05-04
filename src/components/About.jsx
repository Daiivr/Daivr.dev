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
        <div className="section-card flex flex-col justify-center">
          <h3 className="text-[11px] font-semibold tracking-[0.18em] text-slate-200 uppercase">
            profile.json
          </h3>

          <dl className="mt-4 grid grid-cols-2 gap-4 text-xs md:text-sm text-slate-200">
            <div className="space-y-1">
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                location
              </dt>
              <dd className="text-[12px] font-medium text-slate-100">
                Alaska · snow + <span className="rgb-text">RGB</span>
              </dd>
            </div>

            <div className="space-y-1">
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                role
              </dt>
              <dd className="text-[12px] font-medium text-slate-100">
                dev · gamer · bot wrangler
              </dd>
            </div>

            <div className="space-y-1">
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                stack
              </dt>
              <dd className="text-[12px] font-medium text-slate-100">
                TS · React · C# · Unity · Node
              </dd>
            </div>

            <div className="space-y-1">
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                mood
              </dt>
              <dd className="text-[12px] font-medium text-slate-100">
                grinding XP @ 03:00
              </dd>
            </div>

            <div className="col-span-2 space-y-1">
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                projects
              </dt>
              <dd className="flex flex-wrap gap-2">
                <span className="tag-chip">DaiBot</span>
                <a
                  href="https://github.com/Daiivr/PokeNexo"
                  target="_blank"
                  rel="noreferrer"
                  className="tag-chip"
                >
                  PokeNexo
                </a>
                <span className="tag-chip">Emoji Bank</span>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}
