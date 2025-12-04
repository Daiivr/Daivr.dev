import React from 'react'

export default function About() {
  return (
    <section id="about-section" className="section-shell">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="section-card">
          <h2 className="text-sm font-semibold text-slate-100">Sobre mí</h2>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">
			Soy <span className="text-sky-300">Dai</span>, un gremlin digital exiliado en Alaska, siempre con un café frío al lado y demasiadas pestañas abiertas.
			Fan enfermizo de Fallout, Zelda y Pokémon; me encanta romper cosas con código y luego arreglarlas mejor: bots para Discord, webs mimadas y herramientas para automatizar juegos y consolas.
		  </p>
	      <p className="mt-2 text-sm text-slate-300 leading-relaxed">
			Hablo inglés y español, vivo grindando XP en Visual Studio entre anime y música lofi, casi siempre perdido en mundos como Fallout, Minecraft, VRChat o DBD.
			Colecciono más juegos de los que puedo jugar y gasto dinero en cosas que no necesito pero me hacen feliz. Esta página es mi pequeño hub personal: proyectos, links, screenshots y un panel en tiempo real de lo que estoy tramando en Discord. Si algo de todo esto te hace ruido bonito en el cerebro, siéntete en casa. 🎮❄️
		  </p>
	    </div>
        <div className="section-card flex flex-col justify-center">
          <h3 className="text-xs font-semibold text-slate-100">Mini ficha</h3>
          <dl className="mt-3 space-y-2 text-xs text-slate-300">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Ubicación</dt>
              <dd>Alaska · nieve + <span className="rgb-text">RGB</span></dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Rol</dt>
              <dd>Dev de bots y automatizaciones para Discord</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Proyectos</dt>
              <dd>DaiBot · PokeNexo · Emoji Bank</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Stack favorito</dt>
              <dd>TypeScript · React · C# · Discord / SysBot</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Mood</dt>
              <dd>✨ Cozy chaos · grinding XP ✨</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}