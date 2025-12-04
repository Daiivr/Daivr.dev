import React from 'react'

export default function About() {
  return (
    <section id="about-section" className="section-shell">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Sobre mí */}
        <div className="section-card">
          <h2 className="text-sm font-semibold text-slate-100">Sobre mí</h2>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">
            Soy <span className="text-sky-300">Dai</span>, una gremlin digital exiliada en Alaska, siempre con un café frío al lado y demasiadas pestañas abiertas.
            Fan enfermiza de Fallout, Zelda y Pokémon; me encanta romper cosas con código y luego arreglarlas mejor: bots para Discord, webs mimadas y herramientas para automatizar juegos y consolas.
          </p>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Hablo inglés y español, vivo grindando XP en Visual Studio entre anime y música lofi, casi siempre perdida en mundos como Fallout, Minecraft, VRChat o DBD.
            Colecciono más juegos de los que puedo jugar y gasto dinero en cosas que no necesito pero me hacen feliz. Esta página es mi pequeño hub personal: proyectos, links, screenshots y un panel en tiempo real de lo que estoy tramando en Discord.
            Si algo de todo esto te hace ruido bonito en el cerebro, siéntete en casa. 🎮❄️
          </p>
        </div>

        {/* Mini ficha */}
        <div className="section-card flex flex-col justify-center">
          <h3 className="text-[11px] font-semibold tracking-[0.18em] text-slate-200 uppercase">
            Mini ficha
          </h3>

          <dl className="mt-4 grid grid-cols-2 gap-4 text-xs md:text-sm text-slate-200">
            {/* Ubicación */}
            <div className="space-y-1">
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                Ubicación
              </dt>
              <dd className="text-sm font-medium text-slate-100">
                Alaska · nieve + <span className="rgb-text">RGB</span>
              </dd>
            </div>

            {/* Rol */}
            <div className="space-y-1">
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                Rol
              </dt>
              <dd className="text-sm font-medium text-slate-100">
                💻 Dev · 🎮 Gaming
              </dd>
            </div>

            {/* Stack favorito */}
            <div className="space-y-1">
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                Stack favorito
              </dt>
              <dd className="text-sm font-medium text-slate-100">
                TypeScript · React · C# · Unity · Discord / SysBot
              </dd>
            </div>

            {/* Mood */}
            <div className="space-y-1">
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                Mood
              </dt>
              <dd className="text-sm font-medium text-slate-100">
                ✨ Cozy chaos · 🎮 Grinding XP
              </dd>
            </div>

            {/* Proyectos */}
            <div className="col-span-2 space-y-1">
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                Proyectos
              </dt>
              <dd className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-slate-900/60 px-3 py-1 text-[11px] font-medium text-slate-100">
                  DaiBot
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-900/60 px-3 py-1 text-[11px] font-medium text-slate-100">
                  PokeNexo
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-900/60 px-3 py-1 text-[11px] font-medium text-slate-100">
                  Emoji Bank
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}
